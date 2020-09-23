import { CustomError } from 'ts-custom-error'
import { Criteria, RemoteObject, Where } from './s-object-model'
import { setHours } from 'date-fns'
import deepmerge from 'deepmerge'

declare const SObjectModel: { [object_name: string]: new <ObjectType>() => RemoteObject<ObjectType> }

export type TROTransaction<ObjectName, ObjectType> = { type: ObjectName } & {
  [FieldName in keyof ObjectType]?: ObjectType[FieldName] extends boolean
    ? ObjectType[FieldName]
    : ObjectType[FieldName] | null
}

export type TRORecord<ObjectName, ObjectType> = {
  [FieldName in keyof TROTransaction<ObjectName, ObjectType>]: NonNullable<
    TROTransaction<ObjectName, ObjectType>[FieldName]
  >
}

export class TROError extends CustomError {
  constructor(public object_name: string, message: string, public attributes?: object) {
    super(message)
  }

  toObject() {
    return {
      object_name: this.object_name,
      name: this.name,
      message: this.message,
      attributes: this.attributes,
    }
  }
}

let time_zone_offset: number

type SObjectModel<ObjectType> = {
  remote_object: RemoteObject<ObjectType>
  un_accessible_fields: string[]
}
const s_object_models: { [object_name: string]: SObjectModel<unknown> } = {}

export function init(args: { time_zone_offset?: number; un_accessible_fields: { object_name: string; fields: [] }[] }) {
  time_zone_offset = args.time_zone_offset ?? 9
  args.un_accessible_fields.forEach(_ => {
    const som = new SObjectModel[_.object_name]()
    _.fields.forEach(_ => delete som._fields[_ as string])
    s_object_models[_.object_name] = { remote_object: som, un_accessible_fields: [..._.fields] }
  })
}

export function fetchAll<ObjectName extends string, ObjectType>(
  object_name: ObjectName,
  criteria: Criteria<ObjectType> | undefined = {},
): Promise<TRORecord<ObjectName, ObjectType>[]> {
  return new Promise((resolve, reject) => {
    const clone_criteria = deepmerge<typeof criteria>({}, criteria)

    const adjustDate = (where: NonNullable<typeof clone_criteria>['where']) => {
      if (where == null) {
        return
      }

      Object.keys(where).forEach(field_name => {
        if (field_name === 'and' || field_name === 'or') {
          adjustDate(where[field_name]!)
          return
        }

        const w = where[field_name]

        const operator_key = Object.keys(w)[0]
        const value = w[operator_key]
        if (value instanceof Date) {
          w[operator_key] = setHours(value, -time_zone_offset)
          return
        }

        if (Array.isArray(value)) {
          w[operator_key] = value.map(v => (v instanceof Date ? setHours(v, -time_zone_offset) : v))
        }
      })
    }
    adjustDate(clone_criteria.where)

    try {
      ;(s_object_models[object_name] as SObjectModel<ObjectType>).remote_object.retrieve(
        clone_criteria,
        (error, records) => {
          if (error != null) {
            reject(new TROError(object_name, error.message, { criteria, clone_criteria }))
            return
          }

          resolve(
            records.map(record => {
              const result = { type: object_name } as TRORecord<ObjectName, ObjectType>
              Object.keys(record._fields).forEach(key => {
                result[record._fields[key].shorthand || key] = record.get(key as keyof ObjectType)
              })
              return result
            }),
          )
        },
      )
    } catch (error) {
      reject(new TROError(object_name, error.message, { criteria, clone_criteria }))
    }
  })
}

export async function fetchOne<ObjectName extends string, ObjectType>(
  object_name: ObjectName,
  criteria: Criteria<ObjectType> | undefined = {},
) {
  criteria.limit = 1

  const _ = await fetchAll<ObjectName, ObjectType>(object_name, criteria).catch((_: Error) => _)
  if (_ instanceof Error) {
    return Promise.reject(_)
  }

  return _[0]
}

export function ins<ObjectName extends string, ObjectType, Fetch extends true | false = true>(
  props: TROTransaction<ObjectName, ObjectType>,
  options?: { fetch: Fetch },
): Promise<Fetch extends true ? TRORecord<ObjectName, ObjectType> : void> {
  return new Promise((resolve, reject) => {
    const clone_props = deepmerge<typeof props>({}, props)

    Object.keys(clone_props).forEach(_ => {
      const p = clone_props[_]
      if (p instanceof Date) {
        clone_props[_] = setHours(p, -time_zone_offset)
      }
    })

    try {
      ;(s_object_models[clone_props.type] as SObjectModel<ObjectType>).remote_object.create(
        clone_props as { [field_name: string]: ObjectType[keyof ObjectType] },
        async (error, ids) => {
          if (ids.length === 0) {
            reject(new TROError(clone_props.type, error!.message, { props, clone_props }))
            return
          }

          if (options != null && !options.fetch) {
            resolve()
            return
          }

          const _ = await fetchAll<ObjectName, ObjectType>(clone_props.type, {
            where: ({ Id: { eq: ids[0] } } as unknown) as Where<ObjectType>,
          }).catch((_: Error) => _)
          if (_ instanceof Error) {
            reject(_)
            return
          }

          resolve(_[0] as Fetch extends true ? TRORecord<ObjectName, ObjectType> : void)
        },
      )
    } catch (error) {
      reject(new TROError(clone_props.type, error.message, { props, clone_props }))
    }
  })
}

export function upd<ObjectName extends string, ObjectType extends { Id: string }, Fetch extends true | false = true>(
  props: TROTransaction<ObjectName, ObjectType>,
  options?: { fetch: Fetch },
): Promise<Fetch extends true ? TRORecord<ObjectName, ObjectType> : void> {
  return new Promise((resolve, reject) => {
    const clone_props = deepmerge<typeof props>({}, props)

    Object.keys(clone_props).forEach(_ => {
      const p = clone_props[_]
      if (p instanceof Date) {
        clone_props[_] = setHours(p, -time_zone_offset)
      }
    })

    try {
      ;(s_object_models[clone_props.type] as SObjectModel<ObjectType>).remote_object.update(
        [clone_props.Id!],
        clone_props as { [field_name: string]: ObjectType[keyof ObjectType] },
        async error => {
          if (error != null) {
            reject(new TROError(clone_props.type, error.message, { props, clone_props }))
            return
          }

          if (options != null && !options.fetch) {
            resolve()
            return
          }

          const _ = await fetchAll<ObjectName, ObjectType>(clone_props.type, {
            where: { Id: { eq: clone_props.Id } } as Where<ObjectType>,
          }).catch((_: Error) => _)
          if (_ instanceof Error) {
            reject(_)
            return
          }

          resolve(_[0] as Fetch extends true ? TRORecord<ObjectName, ObjectType> : void)
        },
      )
    } catch (error) {
      reject(new TROError(clone_props.type, error.message, { props, clone_props }))
    }
  })
}

export function del<ObjectName extends string, ObjectType extends { Id: string }>(
  props: TROTransaction<ObjectName, ObjectType>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const clone_props = deepmerge<typeof props>({}, props)

    try {
      s_object_models[clone_props.type]!.remote_object.del(clone_props.Id!, error => {
        if (error != null) {
          reject(new TROError(clone_props.type, error.message, { props, clone_props }))
          return
        }

        resolve()
      })
    } catch (error) {
      reject(new TROError(clone_props.type, error.message, { props, clone_props }))
    }
  })
}

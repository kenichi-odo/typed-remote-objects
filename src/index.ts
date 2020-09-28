import { CustomError } from 'ts-custom-error'
import { Criteria, RemoteObject, Where } from './s-object-model'
import { addHours } from 'date-fns'
import deepmerge from 'deepmerge'

declare const SObjectModel: { [object_name: string]: new <ObjectType>() => RemoteObject<ObjectType> }

export { Where }

type TransactionCore<ObjectType> = {
  [FieldName in keyof ObjectType]?: ObjectType[FieldName] extends boolean
    ? ObjectType[FieldName]
    : ObjectType[FieldName] | null
}

export type Transaction<ObjectType> = { [K in keyof TransactionCore<ObjectType>]: TransactionCore<ObjectType>[K] }

type RecordCore<ObjectName, ObjectType> = { type: ObjectName; Id: string } & {
  [FieldName in keyof Transaction<ObjectType>]: NonNullable<Transaction<ObjectType>[FieldName]>
}

export type Record<ObjectName, ObjectType> = {
  [K in keyof RecordCore<ObjectName, ObjectType>]: RecordCore<ObjectName, ObjectType>[K]
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

export function init(args: {
  time_zone_offset?: number
  un_accessible_fields: { object_name: string; fields: string[] }[]
}) {
  time_zone_offset = args.time_zone_offset ?? 9
  args.un_accessible_fields.forEach(_ => {
    const som = new SObjectModel[_.object_name]()
    _.fields.forEach(_ => delete som._fields[_ as string])
    s_object_models[_.object_name] = { remote_object: som, un_accessible_fields: [..._.fields] }
  })
}

export async function fetchAll<ObjectName extends string, ObjectType>(
  object_name: ObjectName,
  options:
    | {
        criteria?: Criteria<ObjectType>
        size?: number
      }
    | undefined = { criteria: {}, size: 2000 },
): Promise<Record<ObjectName, ObjectType>[]> {
  const clone_options = deepmerge<typeof options>({}, options)
  if (clone_options.criteria == null) {
    clone_options.criteria = {}
  }

  const clone_criteria = deepmerge<typeof clone_options.criteria>({}, clone_options.criteria)!
  if (clone_criteria.limit == null && clone_criteria.offset == null) {
    let size = clone_options.size ?? 2000
    let offset = 0

    let results: Record<ObjectName, ObjectType>[] = []
    while (size > 0) {
      if (size > 100) {
        clone_criteria.limit = 100
        size -= 100
      } else {
        clone_criteria.limit = size
        size = 0
      }

      if (offset !== 0) {
        clone_criteria.offset = offset
      }

      const records = await fetchAll(object_name, { criteria: clone_criteria }).catch((_: Error) => _)
      if (records instanceof Error) {
        return Promise.reject(records)
      }

      if (records.length === 0) {
        break
      }

      results = results.concat(records)
      offset += 100
    }

    return Promise.resolve(results)
  }

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
        w[operator_key] = addHours(value, -time_zone_offset)
        return
      }

      if (Array.isArray(value)) {
        w[operator_key] = value.map(v => (v instanceof Date ? addHours(v, -time_zone_offset) : v))
      }
    })
  }
  adjustDate(clone_criteria.where)

  return new Promise((resolve, reject) => {
    try {
      ;(s_object_models[object_name] as SObjectModel<ObjectType>).remote_object.retrieve(
        clone_criteria,
        (error, records) => {
          if (error != null) {
            reject(new TROError(object_name, error.message, { options, clone_options }))
            return
          }

          resolve(
            records.map(record => {
              const result = { type: object_name } as Record<ObjectName, ObjectType>
              Object.keys(record._fields).forEach(key => {
                result[record._fields[key].shorthand || key] = record.get(key as keyof ObjectType)
              })
              return result
            }),
          )
        },
      )
    } catch (error) {
      reject(new TROError(object_name, error.message, { options, clone_options }))
    }
  })
}

export async function fetchOne<ObjectName extends string, ObjectType>(
  object_name: ObjectName,
  criteria: Criteria<ObjectType> | undefined = {},
): Promise<Record<ObjectName, ObjectType> | undefined> {
  const _ = await fetchAll<ObjectName, ObjectType>(object_name, {
    criteria: deepmerge<typeof criteria>({}, criteria),
    size: 1,
  }).catch((_: Error) => _)
  if (_ instanceof Error) {
    return Promise.reject(_)
  }

  return _[0]
}

export function ins<ObjectName extends string, ObjectType, Fetch extends true | false = true>(
  object_name: ObjectName,
  props: Transaction<ObjectType>,
  options?: { fetch: Fetch },
): Promise<Fetch extends true ? Record<ObjectName, ObjectType> : void> {
  const clone_props = deepmerge<typeof props>({}, props)

  Object.keys(clone_props).forEach(_ => {
    const p = clone_props[_]
    if (p instanceof Date) {
      clone_props[_] = addHours(p, -time_zone_offset)
    }
  })

  return new Promise((resolve, reject) => {
    try {
      ;(s_object_models[object_name] as SObjectModel<ObjectType>).remote_object.create(
        clone_props as { [field_name: string]: ObjectType[keyof ObjectType] },
        async (error, ids) => {
          if (ids.length === 0) {
            reject(new TROError(object_name, error!.message, { props, clone_props }))
            return
          }

          if (options != null && !options.fetch) {
            resolve()
            return
          }

          const _ = await fetchAll<ObjectName, ObjectType>(object_name, {
            criteria: {
              where: ({
                Id: { eq: ids[0] },
              } as unknown) as Where<ObjectType>,
            },
          }).catch((_: Error) => _)
          if (_ instanceof Error) {
            reject(_)
            return
          }

          resolve(_[0] as Fetch extends true ? Record<ObjectName, ObjectType> : void)
        },
      )
    } catch (error) {
      reject(new TROError(object_name, error.message, { props, clone_props }))
    }
  })
}

export function upd<ObjectName extends string, ObjectType, Fetch extends true | false = true>(
  object_name: ObjectName,
  id: string,
  props: Transaction<ObjectType>,
  options?: { fetch: Fetch },
): Promise<Fetch extends true ? Record<ObjectName, ObjectType> : void> {
  const clone_props = deepmerge<typeof props>({}, props)

  Object.keys(clone_props).forEach(_ => {
    const p = clone_props[_]
    if (p instanceof Date) {
      clone_props[_] = addHours(p, -time_zone_offset)
    }
  })

  return new Promise((resolve, reject) => {
    try {
      ;(s_object_models[object_name] as SObjectModel<ObjectType>).remote_object.update(
        [id],
        clone_props as { [field_name: string]: ObjectType[keyof ObjectType] },
        async error => {
          if (error != null) {
            reject(new TROError(object_name, error.message, { props, clone_props }))
            return
          }

          if (options != null && !options.fetch) {
            resolve()
            return
          }

          const _ = await fetchAll<ObjectName, ObjectType>(object_name, {
            criteria: { where: ({ Id: { eq: id } } as unknown) as Where<ObjectType> },
          }).catch((_: Error) => _)
          if (_ instanceof Error) {
            reject(_)
            return
          }

          resolve(_[0] as Fetch extends true ? Record<ObjectName, ObjectType> : void)
        },
      )
    } catch (error) {
      reject(new TROError(object_name, error.message, { props, clone_props }))
    }
  })
}

export function del(object_name: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      s_object_models[object_name]!.remote_object.del(id, error => {
        if (error != null) {
          reject(new TROError(object_name, error.message, { id }))
          return
        }

        resolve()
      })
    } catch (error) {
      reject(new TROError(object_name, error.message, { id }))
    }
  })
}

export function criteria<ObjectType>(_: Criteria<ObjectType>) {
  return _
}

export function transaction<ObjectType>(_: Transaction<ObjectType>) {
  return _
}

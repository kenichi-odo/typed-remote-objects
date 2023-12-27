import { CustomError } from 'ts-custom-error'
import { Criteria, Operator, Props, RemoteObjectInstance, Where } from './s-object-model'
import { addHours } from 'date-fns'
import deepmerge from 'deepmerge'

export { Where }

export type Record<SObjectName, SObjectType> = {
  type: SObjectName
  Id: string
} & {
  [Field in keyof Props<SObjectType>]: NonNullable<Props<SObjectType>[Field]>
}

export class TroError extends CustomError {
  constructor(
    public message: string,
    public s_object_name: string,
    public attributes: object,
  ) {
    super()
  }

  toObject() {
    return {
      attributes: this.attributes,
      message: this.message,
      name: this.name,
      s_object_name: this.s_object_name,
    }
  }
}

declare const SObjectModel: {
  [s_object_name: string]: new <SObjectType>() => RemoteObjectInstance<SObjectType>
}

const models: { name: string; instance: RemoteObjectInstance<unknown> }[] = []
const getRemoteObject = <SObjectType>(s_object_name: string) =>
  models.find(_ => _.name === s_object_name)!.instance as RemoteObjectInstance<SObjectType>

let time_zone_offset: number
export const init = (args: {
  time_zone_offset?: number
  un_accessible_fields: {
    s_object_name: string
    fields: string[]
  }[]
}) => {
  time_zone_offset = args.time_zone_offset ?? 9
  args.un_accessible_fields.forEach(_ => {
    const instance = new SObjectModel[_.s_object_name]()
    _.fields.forEach(_ => delete instance._fields[_ as string])
    models.push({ name: _.s_object_name, instance })
  })
}

const BATCH_SIZE = 100
const MAX_SIZE = 2000

export const fetchAll = async <SObjectName extends string, SObjectType>(
  s_object_name: SObjectName,
  options:
    | {
        criteria?: Criteria<SObjectType>
        size?: number
      }
    | undefined = {
    criteria: {},
    size: MAX_SIZE,
  },
) => {
  const clone_options = deepmerge<typeof options>({}, options)
  if (clone_options.criteria == null) {
    clone_options.criteria = {}
  }

  const clone_criteria = deepmerge<typeof clone_options.criteria>({}, clone_options.criteria)!
  if (clone_criteria.limit == null && clone_criteria.offset == null) {
    let size = clone_options.size ?? MAX_SIZE
    let offset = 0

    const results: Record<SObjectName, SObjectType>[] = []
    while (size > 0) {
      if (size > BATCH_SIZE) {
        clone_criteria.limit = BATCH_SIZE
        size -= BATCH_SIZE
      } else {
        clone_criteria.limit = size
        size = 0
      }

      if (offset !== 0) {
        clone_criteria.offset = offset
      }

      const records = await fetchAll(s_object_name, { criteria: clone_criteria })
      if (records.length === 0) {
        break
      }

      results.push(...records)
      offset += BATCH_SIZE
    }

    return results
  }

  let is_no_result = false
  const adjustDate = (where: (typeof clone_criteria)['where']) => {
    if (where == null) {
      return
    }

    Object.keys(where).forEach(field_name => {
      if (field_name === 'and' || field_name === 'or') {
        adjustDate(where[field_name])
        return
      }

      const operator = where[field_name as keyof SObjectType]!
      const operator_key = Object.keys(operator)[0]

      const value = operator[operator_key]
      if (value == null) {
        delete where[field_name]
        return
      }

      if (value instanceof Date) {
        operator[operator_key] = addHours(value, -time_zone_offset)
        return
      }

      if (Array.isArray(value)) {
        if (operator_key === 'in' && value.length === 0) {
          is_no_result = true
          return
        }

        operator[operator_key] = [...new Set(value)].map(v => (v instanceof Date ? addHours(v, -time_zone_offset) : v))
      }
    })
  }
  adjustDate(clone_criteria.where)

  return new Promise<Record<SObjectName, SObjectType>[]>((resolve, reject) => {
    if (is_no_result) {
      setTimeout(() => resolve([]))
      return
    }

    try {
      getRemoteObject<SObjectType>(s_object_name).retrieve(clone_criteria, (error, records) => {
        if (error == null) {
          resolve(
            records.map(record => {
              const result = { type: s_object_name } as Record<SObjectName, SObjectType>
              Object.keys(record._fields).forEach(field_name => {
                const fn = field_name as keyof SObjectType
                result[record._fields[fn].shorthand || fn] = record.get(fn)
              })
              return result
            }),
          )
          return
        }

        reject(new TroError(error.message, s_object_name, { options, criteria: clone_criteria }))
      })
    } catch (error) {
      reject(new TroError((error as Error).message, s_object_name, { options, criteria: clone_criteria }))
    }
  })
}

export const fetchOne = async <SObjectName extends string, SObjectType>(
  s_object_name: SObjectName,
  criteria: Criteria<SObjectType> | undefined = {},
): Promise<Record<SObjectName, SObjectType> | undefined> => {
  const result = await fetchAll<SObjectName, SObjectType>(s_object_name, {
    criteria: deepmerge<typeof criteria>({}, criteria),
    size: 1,
  })
  return result[0]
}

export const ins = <SObjectName extends string, SObjectType, Fetch extends true | false = true>(
  s_object_name: SObjectName,
  props: Props<SObjectType>,
  options?: { fetch: Fetch },
) => {
  const clone_props = deepmerge<typeof props>({}, props)

  Object.keys(clone_props).forEach(_ => {
    const p = clone_props[_]
    if (p instanceof Date) {
      clone_props[_] = addHours(p, -time_zone_offset)
    }
  })

  return new Promise<Fetch extends true ? Record<SObjectName, SObjectType> : void>((resolve: Function, reject) => {
    try {
      getRemoteObject<SObjectType>(s_object_name).create(
        clone_props as { [Field in keyof SObjectType]: SObjectType[Field] },
        async (error, ids) => {
          if (ids.length === 0) {
            reject(new TroError(error!.message, s_object_name, { props }))
            return
          }

          if (options != null && !options.fetch) {
            resolve()
            return
          }

          const _ = await fetchAll<SObjectName, SObjectType>(s_object_name, {
            criteria: {
              where: {
                Id: { eq: ids[0] },
              } as unknown as Where<SObjectType>,
            },
          }).catch((_: Error) => _)
          if (_ instanceof Error) {
            reject(_)
            return
          }

          resolve(_[0] as Fetch extends true ? Record<SObjectName, SObjectType> : void)
        },
      )
    } catch (error) {
      reject(new TroError((error as Error).message, s_object_name, { props }))
    }
  })
}

export const upd = <SObjectName extends string, SObjectType, Fetch extends true | false = true>(
  s_object_name: SObjectName,
  id: string,
  props: Props<SObjectType>,
  options?: { fetch: Fetch },
) => {
  const clone_props = deepmerge<typeof props>({}, props)

  Object.keys(clone_props).forEach(_ => {
    const p = clone_props[_]
    if (p instanceof Date) {
      clone_props[_] = addHours(p, -time_zone_offset)
    }
  })

  return new Promise<Fetch extends true ? Record<SObjectName, SObjectType> : void>((resolve: Function, reject) => {
    try {
      getRemoteObject<SObjectType>(s_object_name).update(
        [id],
        clone_props as { [Field in keyof SObjectType]: SObjectType[Field] },
        async error => {
          if (error != null) {
            reject(new TroError(error.message, s_object_name, { props }))
            return
          }

          if (options != null && !options.fetch) {
            resolve()
            return
          }

          const _ = await fetchAll<SObjectName, SObjectType>(s_object_name, {
            criteria: {
              where: {
                Id: { eq: id },
              } as unknown as Where<SObjectType>,
            },
          }).catch((_: Error) => _)
          if (_ instanceof Error) {
            reject(_)
            return
          }

          resolve(_[0] as Fetch extends true ? Record<SObjectName, SObjectType> : void)
        },
      )
    } catch (error) {
      reject(new TroError((error as Error).message, s_object_name, { props }))
    }
  })
}

export const del = (s_object_name: string, id: string) =>
  new Promise<void>((resolve, reject) => {
    try {
      getRemoteObject(s_object_name).del(id, error => {
        if (error == null) {
          resolve()
          return
        }

        reject(new TroError(error.message, s_object_name, { id }))
      })
    } catch (error) {
      reject(new TroError((error as Error).message, s_object_name, { id }))
    }
  })

export const criteria = <SObjectType>(_: Criteria<SObjectType>) => _

export const props = <SObjectType>(_: Props<SObjectType>) => _

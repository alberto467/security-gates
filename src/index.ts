const ENTITY_NAME_SYMBOL: unique symbol = Symbol()
export type AnyClass<T = any> = new (...args: any[]) => T
export type AnyRecord = Record<PropertyKey, unknown>
export type NamedRecord<N extends string = string> = AnyRecord & { [ENTITY_NAME_SYMBOL]: N }

export type CheckFunction<E extends AnyClass = AnyClass> = (
  item: E extends AnyClass<infer T> ? T : never
) => boolean | Promise<boolean>
export type Check<E = any> = (E extends AnyClass ? CheckFunction<E> : never) | true

export type MaybeArray<I> = I | I[]
function castMaybeArray<I>(maybeArr: MaybeArray<I>): I[] {
  if (Array.isArray(maybeArr)) return maybeArr
  return [maybeArr]
}

export type PermissionMap<Actions extends string, Entities> = {
  [action in Actions | '*']: { [entity in Extract<Entities, string> | '*']: Check[] }
}

class Gate<Actions extends string, Entities> {
  private permissionMap: PermissionMap<Actions, Entities>

  constructor(permissionMap: PermissionMap<Actions, Entities>) {
    this.permissionMap = permissionMap
  }

  async can<E extends AnyClass | Entities>(
    action: Actions,
    entity: E extends AnyClass<infer T> ? T : Extract<Entities, string> | NamedRecord<Extract<Entities, string>>
  ): Promise<boolean> {
    const entityName = getEntityName(entity) as Extract<Entities, string>

    const checks = [
      ...(this.permissionMap?.['*']?.['*'] ?? []),
      ...(this.permissionMap?.['*']?.[entityName] ?? []),
      ...(this.permissionMap?.[action]?.['*'] ?? []),
      ...(this.permissionMap?.[action]?.[entityName] ?? [])
    ] as Check<E>[]

    if (checks.length === 0) console.log(`No rules found! Detected entity name "${entityName}"`)

    if (checks.some(check => check === true)) return true

    if (typeof entity === 'string' || typeof entity === 'function') {
      console.log('To allow this action an instance must be provided as to run the check function against it!')
      return false
    }

    for (const check of checks.filter(check => typeof check === 'function') as CheckFunction<
      E extends AnyClass<infer T> ? T : never
    >[]) {
      const result = await Promise.resolve(check(entity as E extends AnyClass<infer T> ? T : never))
      if (result === true) return true
    }

    return false
  }

  async cannot<E extends AnyClass | Entities>(
    action: Actions,
    entity: E extends AnyClass<infer T> ? T : Extract<Entities, string> | NamedRecord<Extract<Entities, string>>
  ): Promise<boolean> {
    return !(await this.can<E>(action, entity))
  }
}

export type { Gate }

function getEntityName(entity: string | AnyClass | InstanceType<AnyClass> | NamedRecord): string {
  if (typeof entity === 'string') return entity
  if (typeof entity === 'function') return (entity as (...args: any[]) => any).name
  return (entity as NamedRecord)?.[ENTITY_NAME_SYMBOL] || entity.constructor.name
}

export class GateSmith<Actions extends string, Entities> {
  private permissionMap = {} as PermissionMap<Actions, Entities>

  can<E extends Entities | AnyClass>(
    action: MaybeArray<Actions | '*'>,
    entity: E extends AnyClass ? E : MaybeArray<E | '*'>,
    check?: E extends AnyClass ? CheckFunction<E> : never
  ): void {
    const actionArr = castMaybeArray(action)
    const entityArr = castMaybeArray(entity)

    for (const action of actionArr) {
      if (!(action in this.permissionMap)) this.permissionMap[action] = {} as PermissionMap<Actions, Entities>[Actions]

      const actionMap = this.permissionMap[action]
      for (const entity of entityArr) {
        const entityName = getEntityName(entity) as Extract<E, string>

        if (!(entityName in actionMap)) actionMap[entityName] = []
        actionMap[entityName].push((check as CheckFunction) ?? true)
      }
    }
  }

  buildGate(): Gate<Actions, Entities> {
    return new Gate(this.permissionMap)
  }
}

export default async function buildGate<Actions extends string, Entities>(
  builder: (gateSmith: GateSmith<Actions, Entities>) => void | Promise<void>
): Promise<Gate<Actions, Entities>> {
  const gateSmith = new GateSmith<Actions, Entities>()

  await Promise.resolve(builder(gateSmith))

  return gateSmith.buildGate()
}

export function namedEntity<N extends string>(name: N, obj: AnyRecord): NamedRecord<N> {
  return { ...obj, [ENTITY_NAME_SYMBOL]: name }
}

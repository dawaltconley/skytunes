class CacheItem<Value = any> {
  #value: Value | null
  #recalculate: () => Value
  dependencies: CacheItem[]
  dependents: CacheItem[] = []

  constructor(calculate: () => Value, dependencies: CacheItem[] = []) {
    this.#value = calculate()
    this.#recalculate = calculate
    this.dependencies = dependencies
    dependencies.forEach(dep => dep.dependents.push(this))
  }

  isCached(): boolean {
    return this.#value !== null
  }

  get(): Value {
    return this.#value ?? this.set(this.#recalculate())
  }

  set(v: Value): Value {
    this.clear()
    this.#value = v
    return v
  }

  clear() {
    this.dependents.forEach(dep => dep.clear())
    this.#value = null
  }
}

export { CacheItem }

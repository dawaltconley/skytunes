/**
 * An abstraction class to handle items with expensive syncronous calculations.
 * Its value is only recalculated after it has been manually cleared, or when
 * any items it depends on have been cleared.
 */
class CacheItem<Value = any> {
  #value: Value | null = null
  #recalculate: () => Value
  dependencies: CacheItem[]
  dependents: CacheItem[] = []

  /**
   * @param calculate - a function that returns a new value whenever a cached
   * item needs to be recalculated.
   * @param dependencies - a list of CacheItems that this depends on. this
   * items cache will be cleared whenever any dependencies are updated.
   */
  constructor(calculate: () => Value, dependencies: CacheItem[] = []) {
    this.#recalculate = calculate
    this.dependencies = dependencies
    dependencies.forEach(dep => dep.dependents.push(this))
  }

  isCached(): boolean {
    return this.#value !== null
  }

  /** gets the cached value or recalculates it if needed */
  get(): Value {
    return this.#value ?? this.set(this.#recalculate())
  }

  /** sets the cached value and clears its dependents */
  set(v: Value): Value {
    this.clear()
    this.#value = v
    return v
  }

  /** clears the cache of this item and all of its dependents */
  clear() {
    if (this.#value !== null) {
      this.dependents.forEach(dep => dep.clear())
      this.#value = null
    }
  }
}

export { CacheItem }

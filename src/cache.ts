import { Tables } from '@koishijs/cache'
import { Context } from 'koishi'
import { V1LifetimeMatchesItem } from './henrik-valorant'

export class Cache<K extends keyof Tables, T extends Tables[K]> {
    constructor(
        private ctx: Context,
        public readonly tableName: K
    ) {}

    get(id: string): Promise<T | undefined> {
        return this.ctx.cache.get(this.tableName, id)
    }

    async findByValue(value: T): Promise<string | undefined> {
        for await(const [id, v] of this.ctx.cache.entries(this.tableName)) {
            if (v === value) return id
        }
        return undefined
    }

    set(id: string, value: T): Promise<void> {
        return this.ctx.cache.set(this.tableName, id, value)
    }

    async delete(id: string): Promise<void> {
        await this.ctx.cache.delete(this.tableName, id)
    }

    async clear(): Promise<void> {
        await this.ctx.cache.clear(this.tableName)
    }

    async size(): Promise<number> {
        let i = 0;
        for await (const _ of this.ctx.cache.keys(this.tableName)) {
            i++
        }
        return i
    }
}

declare module '@koishijs/cache' {
    interface Tables {
        'valorant-short-id': string,
    }
}
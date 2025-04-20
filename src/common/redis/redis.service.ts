import { Injectable } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService {
    private readonly redis: Redis;

    constructor(){
        this.redis = new Redis({
            host: 'localhost',
            port: 6379
        });
    }

    async get(key: string): Promise<any> {
        const data = await this.redis.get(key);
        return data ? JSON.parse(data) : null;
    }

    async set(key: string, value: any, ttl: number = 86400): Promise<void> {
        await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    }

    async del(key: string): Promise<void> { 
        await this.redis.del(key);
    }
}

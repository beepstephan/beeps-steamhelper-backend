import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { User } from "./entities/user.entity";

@Injectable()
export class UserRepository {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) {}

    async findBySteamId (steamId: string): Promise<User | null> {
        return this.userRepository.findOne({where: { steamId }});
    }

    async createUser (steamId: string, username: string, avatar: string): Promise<User> {
        const user = this.userRepository.create({steamId, username, avatar});
        return this.userRepository.save(user);
    }
}
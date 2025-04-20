import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from "typeorm";
import { UserGame } from "../../game/entities/user-game.entity";

@Entity()
export class User {
    @PrimaryGeneratedColumn('increment')
    id: number;
    
    @Column({unique: true})
    steamId: string;

    @Column()
    username: string;

    @Column()
    avatar: string;

    @OneToMany(() => UserGame, (userGame) => userGame.user)
    userGames: UserGame[];
}


import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { UserGame } from "./user-game.entity";

@Entity()
export class Game {
    @PrimaryGeneratedColumn('increment')
    id: number;

    @Column({ unique: true, type: 'int', nullable: true })
    appid: number | null;

    @Column()
    name: string;

    @Column()
    genre: string;

    @Column()
    isMultiplayer: boolean;

    @Column()
    isMixed: boolean;

    @Column({ default: true })
    isVerified: boolean;

    @OneToMany(() => UserGame, (userGame) => userGame.game)
    userGames: UserGame[];
}
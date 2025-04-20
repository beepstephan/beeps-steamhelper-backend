import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Game } from './game.entity';

@Entity()
export class UserGame {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @ManyToOne(() => User, (user) => user.userGames)
  user: User;

  @ManyToOne(() => Game, (game) => game.userGames)
  game: Game;

  @Column()
  playtime: number;

  @Column()
  playtime_2weeks: number;

  @Column()
  updatedAt: Date;

  @Column({ default: false })
  isFavorite: boolean;
}
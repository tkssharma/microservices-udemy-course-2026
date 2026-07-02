import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'pending' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}

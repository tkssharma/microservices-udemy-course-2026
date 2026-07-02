import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async findAll(): Promise<Order[]> {
    this.logger.log('Fetching all orders');
    return this.orderRepository.find();
  }

  async findOne(id: string): Promise<Order | null> {
    this.logger.log({ orderId: id }, 'Fetching order');
    return this.orderRepository.findOneBy({ id });
  }

  async create(data: Partial<Order>): Promise<Order> {
    this.logger.log({ userId: data.userId, amount: data.amount }, 'Creating order');
    const order = this.orderRepository.create(data);
    const saved = await this.orderRepository.save(order);
    this.logger.log({ orderId: saved.id }, 'Order created successfully');
    return saved;
  }
}

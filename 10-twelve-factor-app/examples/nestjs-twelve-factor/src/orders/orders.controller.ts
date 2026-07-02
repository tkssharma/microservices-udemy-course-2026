import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order } from './order.entity';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  findAll(): Promise<Order[]> {
    return this.ordersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Order | null> {
    return this.ordersService.findOne(id);
  }

  @Post()
  create(@Body() data: Partial<Order>): Promise<Order> {
    return this.ordersService.create(data);
  }
}

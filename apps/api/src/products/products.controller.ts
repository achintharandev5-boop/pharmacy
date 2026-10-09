import { Controller, Get, Param, Query, BadRequestException, ParseUUIDPipe } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('search')
  async search(@Query('q') q: string) {
    if (!q || q.trim() === '') {
      throw new BadRequestException('Search query "q" is required');
    }
    return this.productsService.searchByName(q);
  }

  @Get('barcode/:barcode')
  async getByBarcode(@Param('barcode') barcode: string) {
    return this.productsService.findByBarcode(barcode);
  }

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findById(id);
  }
}

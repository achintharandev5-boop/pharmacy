import { BadRequestException, Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('search')
  async search(@Query('q') q: string) {
    if (!q || q.trim() === '') {
      throw new BadRequestException('Search query "q" is required');
    }
    if (q.length > 100) throw new BadRequestException('Search query is too long');
    return this.productsService.searchByName(q);
  }

  @Get('barcode/:barcode')
  async getByBarcode(@Param('barcode') barcode: string) {
    if (!/^[\w-]{1,64}$/.test(barcode)) throw new BadRequestException('Invalid barcode');
    return this.productsService.findByBarcode(barcode);
  }

  @Get(':id')
  async getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findById(id);
  }
}

import { Injectable } from '@nestjs/common';
import { HotelsService } from '../hotels/hotels.service';

@Injectable()
export class AssistantRetrievalService {
  constructor(private readonly hotels: HotelsService) {}

  hotel(hotelId: string) {
    return this.hotels.get(hotelId);
  }
}

import { Controller, Get, NotFoundException, Param } from "@nestjs/common";
import { OverlayService } from "./overlay.service";

@Controller("overlay")
export class OverlayController {
  constructor(private readonly overlay: OverlayService) {}

  @Get(":key")
  async settings(@Param("key") key: string) {
    const settings = await this.overlay.getSettings(key);
    if (!settings) throw new NotFoundException("Overlay not found");
    return settings;
  }
}

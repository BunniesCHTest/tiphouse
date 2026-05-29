import { Controller, Get, NotFoundException, Param, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { OverlayService } from "./overlay.service";

@Controller("overlay")
export class OverlayController {
  constructor(private readonly overlay: OverlayService) {}

  @Get("tts/th")
  async thaiTts(@Query("text") text: string, @Res() res: Response) {
    const audio = await this.overlay.generateThaiTts(text || "");
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(audio);
  }

  @Get(":key")
  async settings(@Param("key") key: string) {
    const settings = await this.overlay.getSettings(key);
    if (!settings) throw new NotFoundException("Overlay not found");
    return settings;
  }
}

import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL, credentials: true },
  namespace: "/overlay",
})
export class OverlayGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(OverlayGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`overlay client connected ${client.id}`);
  }

  @SubscribeMessage("join_overlay")
  joinOverlay(@ConnectedSocket() client: Socket, @MessageBody() payload: { streamerKey: string }) {
    client.join(`overlay:${payload.streamerKey}`);
    return { ok: true };
  }

  emitDonation(streamerKey: string, payload: unknown) {
    this.server.to(`overlay:${streamerKey}`).emit("new_donation", payload);
  }
}

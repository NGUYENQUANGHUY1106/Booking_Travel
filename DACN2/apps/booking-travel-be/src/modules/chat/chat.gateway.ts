import { HttpException, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { OwnerApplicationStatus, UserRole, UserStatus } from '@prisma/client';
import type { Server, Socket } from 'socket.io';
import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ChatService } from './chat.service';
import { JoinConversationDto } from './dto/join-conversation.dto';
import { SendMessageDto } from './dto/send-message.dto';

type AccessTokenPayload = { sub?: unknown; sessionId?: unknown };
type ChatSocket = Omit<Socket, 'data'> & {
  data: { user?: AuthenticatedUser };
};

const socketValidationPipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
  exceptionFactory: () => new WsException('Dữ liệu realtime không hợp lệ.'),
});

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
@UsePipes(socketValidationPipe)
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly chat: ChatService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    server.use((socket, next) => {
      void this.authenticate(socket as ChatSocket).then(
        () => next(),
        () => {
          next(new Error('Cần access token hợp lệ để kết nối chat.'));
        },
      );
    });
  }

  @SubscribeMessage('conversation:join')
  async join(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() input: JoinConversationDto,
  ) {
    try {
      const user = this.requireUser(client);
      await this.chat.assertParticipant(input.conversationId, user.id);
      await client.join(this.room(input.conversationId));
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, error: this.publicError(error) };
    }
  }

  @SubscribeMessage('message:send')
  async send(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() input: SendMessageDto,
  ) {
    try {
      const user = this.requireUser(client);
      const message = await this.chat.sendMessage(
        input.conversationId,
        user.id,
        input.content,
      );
      this.server
        .to(this.room(input.conversationId))
        .emit('message:new', message);
      return { ok: true as const, message };
    } catch (error) {
      return { ok: false as const, error: this.publicError(error) };
    }
  }

  @SubscribeMessage('conversation:read')
  async read(
    @ConnectedSocket() client: ChatSocket,
    @MessageBody() input: JoinConversationDto,
  ) {
    try {
      const user = this.requireUser(client);
      const receipt = await this.chat.markRead(input.conversationId, user.id);
      this.server
        .to(this.room(input.conversationId))
        .emit('conversation:read', receipt);
      return { ok: true as const, receipt };
    } catch (error) {
      return { ok: false as const, error: this.publicError(error) };
    }
  }

  private async authenticate(client: ChatSocket) {
    const auth = client.handshake.auth as { token?: unknown };
    const token = auth.token;
    if (typeof token !== 'string' || !token) throw new Error('missing token');

    const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
    if (
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.sessionId !== 'string' ||
      !payload.sessionId
    ) {
      throw new Error('invalid token');
    }

    const [user, session] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          role: true,
          status: true,
          isActive: true,
          ownerApplication: { select: { status: true } },
          ownerProfile: { select: { isActive: true } },
        },
      }),
      this.prisma.authSession.findFirst({
        where: { id: payload.sessionId, userId: payload.sub },
        select: { revokedAt: true, expiresAt: true },
      }),
    ]);
    if (
      !user?.isActive ||
      user.status !== UserStatus.ACTIVE ||
      (user.role !== UserRole.USER && user.role !== UserRole.HOTEL_OWNER) ||
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date()
    ) {
      throw new Error('inactive session');
    }
    if (
      user.role === UserRole.HOTEL_OWNER &&
      (user.ownerApplication?.status !== OwnerApplicationStatus.VERIFIED ||
        user.ownerProfile?.isActive !== true)
    ) {
      throw new Error('blocked owner');
    }

    client.data.user = {
      id: user.id,
      role: user.role,
      permissions: [],
      sessionId: payload.sessionId,
    };
  }

  private requireUser(client: ChatSocket): AuthenticatedUser {
    const user = client.data.user;
    if (!user) throw new WsException('Cần đăng nhập để nhắn tin.');
    return user;
  }

  private room(conversationId: string) {
    return `conversation:${conversationId}`;
  }

  private publicError(error: unknown) {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') return response;
      const message = (response as { message?: string | string[] }).message;
      if (!message) return 'Không thể xử lý tin nhắn lúc này.';
      return Array.isArray(message) ? message.join('\n') : String(message);
    }
    if (error instanceof WsException) {
      const wsError = error.getError();
      if (typeof wsError === 'string') return wsError;
      if (wsError && typeof wsError === 'object') {
        const message = (wsError as { message?: unknown }).message;
        if (typeof message === 'string') return message;
        if (
          Array.isArray(message) &&
          message.every((item) => typeof item === 'string')
        ) {
          return message.join('\n');
        }
      }
    }
    return 'Không thể xử lý tin nhắn lúc này.';
  }
}

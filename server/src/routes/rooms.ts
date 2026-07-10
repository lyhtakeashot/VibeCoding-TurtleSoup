import { Router } from 'express';
import { manager } from '../games/manager.js';

export const roomsRouter = Router();

/** 获取活跃房间列表（不暴露敏感数据） */
roomsRouter.get('/', (_req, res) => {
  const rooms = manager.listPublicRooms();
  res.json({ rooms });
});

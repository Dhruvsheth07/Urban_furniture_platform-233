import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../../utils/prisma';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ message: 'Email and password are required' });
      return;
    }

    const user = await prisma.users.findUnique({
      where: { email },
      include: { user_roles: { include: { roles: true } } },
    });

    if (!user) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid email or password' });
      return;
    }
    
    const role = user.user_roles[0]?.roles;

    const token = jwt.sign(
      { userId: user.id, roleId: role?.id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: role?.name,
        roleKey: role?.key,
        contactId: (user as any).contactId,
        permissions: [],
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

import express, {Request, Response, NextFunction} from 'express';
import  { PrismaClient }  from '@prisma/client';
import { Secret, decode, verify, sign } from 'jsonwebtoken';
import {hash,compare} from 'bcryptjs';


const server = express();
server.use(express.json());
server.listen("3333", () => {
    console.log("Server running...")
})

const prisma = new PrismaClient();
const secretKey = 'ec3116203bea339427238d836186b3e2';

const authenticateJWT = (req:Request, res: Response, next:NextFunction) => {
    const jwtToken = req.headers.authorization;
    if (!jwtToken) {
        return res.status(401).send('Access denied');
    }
    const [, token] = jwtToken.split(" ");

    verify(token, secretKey, (err, user:any) => {
        if (err) {
            return res.status(403).send('Invalid token');
        }
        req.user = user;
        next();
    });
};

server.post('/register', async (req, res) => {
    const { name, email, password, role, cpf, creditCard, phoneNumber } = req.body;
    const hashedPassword = await hash(password, 10);

    const user = await prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
            role,
            cpf,
            phoneNumber
        }
    });

    res.json(user);
});

server.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user || !await compare(password, user.password)) {
        return res.status(401).send('Invalid email or password');
    }

    const token = sign({ id: user.id, role: user.role }, secretKey, { expiresIn: '1h' });
    res.json({ token });
});

server.post('/api/payment/cards', authenticateJWT, async (req, res) => {
    const { userId, type, name, number, cvv, expiry } = req.body; 
    const id = parseInt(userId)

    if (!userId || !type || !name || !number || !cvv || !expiry) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }
  
    try {
      const card = await prisma.creditCards.create({
        data: {
          type,
          name,
          number,
          cvv,
          expiry,
          userId: id
        },
      });
  
      return res.json(card);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao criar o cartão de crédito' });
    }
  });
  
// Vulnerabilidade BOLA: qualquer usuário autenticado pode acessar dados sensíveis de qualquer outro usuário
  server.get('/api/payment/cards/:creditCardID', authenticateJWT, async (req, res) => {
    const { creditCardID } = req.params;
    const cardID = parseInt(creditCardID);
 
    /** Correção
    const jwtToken:any= req.headers.authorization;
    const [, token] = jwtToken.split(" ");
    const authenticatedUser:any = verify(token, secretKey);
*/
    const creditCard = await prisma.creditCards.findUnique({
        where: { id: cardID },
        
    });

    if (!creditCard) {
        return res.status(404).send('Card Not Found');
    }
    /** Correção
    if (creditCard.userId !== authenticatedUser.id) {
        return res.status(403).json('Access Denied');
    } */

    
    res.json(creditCard);
});


server.get('/user/:id', authenticateJWT, async (req, res) => {
    const {id} = req.params; 
    const userID = parseInt(id);

    const user = await prisma.user.findUnique({
        where: { id: userID },
        include:{
            creditCards: true,
          }
    });

    if (!user) {
        return res.status(404).send('User not found');
    }

    // Vulnerabilidade BOLA: qualquer usuário autenticado pode acessar dados sensíveis de qualquer outro usuário
    res.json(user);
});

server.get("/user", authenticateJWT, (req: Request, res: Response) => {
    res.status(200).send("OK")
})  

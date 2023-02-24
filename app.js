const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const fileUpload = require('express-fileupload');
const port = http://191.101.14.137:8000/;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const mysql = require('mysql2/promise');
const nodeCron = require("node-cron");

const createConnection = async () => {
	return await mysql.createConnection({
		host: 'localhost',
		user: 'root',
		password: '',
		database: 'pontestec'
	});
}

const agendamentoZDG = async () => {
	const connection = await createConnection();
	const [rows] = await connection.execute('SELECT * FROM zdgagendafull WHERE `status` IS NULL;');
	if (rows.length > 0) return rows;
	return false;
}

const ZDG = async (id) => {
	const connection = await createConnection();
	const [rows] = await connection.execute('UPDATE zdgagendafull SET `status` = "enviado" WHERE zdgagendafull.id = ?;', [id]);
	if (rows.length > 0) return true;
	return false;
}

app.use(express.json());
app.use(express.urlencoded({
extended: true
}));
app.use(fileUpload({
debug: true
}));

app.get('/', (req, res) => {
  res.sendFile('index.html', {
    root: __dirname
  });
});

const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'bot-zdg' }),
  puppeteer: { headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // <- this one doesn't works in Windows
      '--disable-gpu'
    ] }
});

client.initialize();

io.on('connection', function(socket) {
  socket.emit('message', 'Conectando...');

client.on('qr', (qr) => {
    console.log('QR RECEIVED', qr);
    qrcode.toDataURL(qr, (err, url) => {
      socket.emit('qr', url);
      socket.emit('message', 'QRCode recebido, aponte a câmera  seu celular!');
    });
});

client.on('ready', async () => {
    socket.emit('ready', 'Dispositivo pronto!');
    socket.emit('message', 'Dispositivo pronto!');	
    nodeCron.schedule('*/30 * * * * *', async function () {
      const agendamentos = await agendamentoZDG();
      if (agendamentos === false){
        console.log('Não existem mensagens pendentes.');
      }
      const hoje = new Date();
      for (const angendamento of agendamentos){
        if(angendamento.horario > hoje){
          console.log('BOT-ZDG - Mensagem ID: ' + angendamento.id + ' - ainda não atingiu o horário')
        }
        if(angendamento.horario < hoje){
          if (angendamento.mensagem !== ''){
              client.sendMessage(angendamento.destino + '@c.us', angendamento.mensagem)
          }
            if (angendamento.midia !== '') {
                const media = await MessageMedia.fromUrl(angendamento.midia)
                client.sendMessage(angendamento.destino + '@c.us', media, { caption: '© ÓTICAS DINIZ' })
            }
         
          await ZDG(angendamento.id)
        }
      }
    });
});

client.on('authenticated', () => {
    socket.emit('authenticated', 'Autenticado!');
    socket.emit('message', 'Autenticado!');
    console.log('Autenticado');
});

client.on('auth_failure', function() {
    socket.emit('message', 'Falha na autenticação, reiniciando...');
    console.error('Falha na autenticação');
});

client.on('change_state', state => {
  console.log('Status de conexão: ', state );
});

client.on('disconnected', (reason) => {
  socket.emit('message', 'Cliente desconectado!');
  console.log('Cliente desconectado', reason);
  client.initialize();
});
});

server.listen(port, function() {
        console.log('rodando na porta *: ' + port);
});

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import * as ftp from 'basic-ftp';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough, Readable } from 'stream';

// --- CONFIGURATION ---
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'phrase_secrete_nas';
const USERS_FILE = './users.json';

const FTP_CONFIG = {
    host:  process.env.FTP_HOST || "ftp",
    user: process.env.FTP_USER,
    password: process.env.FTP_PASSWORD,
    secure: false 
};

const FTP_PATHS = {
    camera: "/FI9816P_00626EEC9763/record", 
    shared: "/shared_files"
};

// --- MIDDLEWARES ---

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// --- ROUTES ---

// 1. LOGIN
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    
    // Le serveur trouve l'utilisateur (Admin ou Invite) grâce au MDP unique
    const user = data.users.find(u => u.password === password);

    if (user) {
        const token = jwt.sign({ username: user.username, role: user.role }, process.env.JWT_SECRET);
        return res.json({ token, role: user.role });
    }
    res.status(401).send('Identifiants incorrects');
});

// 2. LISTING FICHIERS
app.get('/api/files/:folder', authenticateToken, async (req, res) => {
    const folderKey = req.params.folder; 
    const remotePath = FTP_PATHS[folderKey];
    const client = new ftp.Client();

    try {
        await client.access(FTP_CONFIG);
        const list = await client.list(remotePath);
        console.log("LOG DEBUG - Contenu brut du FTP :", list);
        
        // On transforme le format FTP en format compatible avec ton tableau Angular
        const files = list
            .filter(f => f.type === 1) // On ne garde que les fichiers
            .map(f => ({
                id: f.name,
                name: f.name,
                size: f.size, // Taille en Mo
                createdAt: f.modifiedAt,
                type: f.name.match(/\.(mp4|mkv|avi)$/i) ? 'video' : 'file'
            }))
            .sort((a, b) => b.createdAt - a.createdAt);

        console.log(`🚀 ${files.length} fichiers envoyés pour ${folderKey}`);
        res.json(files);
    } catch (err) {
        console.error("Erreur FTP:", err);
        res.status(500).json({ error: err.message });
    } finally {
        client.close();
    }
});

// 3. STREAMING (FTP -> FFmpeg -> Navigateur)
app.get('/api/video/:id', authenticateToken, async (req, res) => {
    const client = new ftp.Client();
    try {
        await client.access(FTP_CONFIG);
        const remotePath = `${FTP_PATHS.camera}/${req.params.id}`;

        // On crée un tunnel de données
        const streamBridge = new PassThrough();
        
        // On informe le navigateur
        res.setHeader('Content-Type', 'video/mp4');

        // FFmpeg : On lui donne un peu plus de marge pour analyser
        const ffmpegProcess = ffmpeg(streamBridge)
            .inputOptions([
                '-probesize 5000000',   // Analyse 5Mo pour trouver les métadonnées
                '-analyzeduration 5000000'
            ])
            .videoCodec('copy') // On ne touche pas au flux pour aller plus vite
            .audioCodec('copy')
            .format('mp4')
            .outputOptions([
                '-movflags frag_keyframe+empty_moov+default_base_moof',
                '-pix_fmt yuv420p'
            ])
            .on('start', () => console.log('🎬 FFmpeg a enfin saisi le flux !'))
            .on('error', (err) => {
                if (!err.message.includes('SIGKILL')) console.error('❌ FFmpeg Error:', err.message);
            });

        // On lance le téléchargement
        // On utilise pipe() pour que le flux soit poussé au fur et à mesure
        client.downloadTo(streamBridge, remotePath).then(() => {
            console.log("🏁 FTP entièrement transmis.");
            client.close();
        }).catch(err => {
            console.error("❌ Erreur FTP:", err.message);
            client.close();
        });

        ffmpegProcess.pipe(res);

    } catch (err) {
        console.error("❌ Accès FTP impossible:", err.message);
        res.status(404).send('Vidéo introuvable');
    }
});

// 4. DOWNLOAD (Via FTP)
app.get('/api/download/:folder/:id', authenticateToken, async (req, res) => {
    const client = new ftp.Client();
    try {
        await client.access(FTP_CONFIG);
        const remotePath = `${FTP_PATHS[req.params.folder]}/${req.params.id}`;
        
        // On indique au navigateur qu'il s'agit d'un fichier à télécharger
        res.setHeader('Content-Disposition', `attachment; filename="${req.params.id}"`);
        
        // Correction : Utilisation de downloadTo
        // On passe directement la réponse "res" comme destination du flux
        await client.downloadTo(res, remotePath);
        
    } catch (err) {
        console.error("Erreur téléchargement FTP:", err.message);
        if (!res.headersSent) {
            res.status(404).send('Erreur de téléchargement FTP');
        }
    } finally {
        client.close();
    }
});

// 5. UPLOAD (Mémoire -> FTP)
const upload = multer({ storage: multer.memoryStorage() });
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).send('Aucun fichier reçu.');

    const client = new ftp.Client();
    try {
        await client.access(FTP_CONFIG);
        const remotePath = `${FTP_PATHS.shared}/${Date.now()}-${req.file.originalname}`;
        const stream = Readable.from(req.file.buffer);
        
        await client.uploadFrom(stream, remotePath);
        res.status(201).json({ message: 'Upload FTP réussi !' });
    } catch (err) {
        res.status(500).send("Erreur transfert FTP : " + err.message);
    } finally {
        client.close();
    }
});

// 6. SUPPRESSION (Via FTP)
app.delete('/api/files/:folder/:id', authenticateToken, async (req, res) => {
    if (req.user.role !== 'admin' && req.params.folder !== 'shared') {
        return res.status(403).json({ error: "Interdit" });
    }

    const client = new ftp.Client();
    try {
        await client.access(FTP_CONFIG);
        const remotePath = `${FTP_PATHS[req.params.folder]}/${req.params.id}`;
        await client.remove(remotePath);
        res.sendStatus(204);
    } catch (err) {
        res.status(404).send('Fichier non trouvé sur le FTP');
    } finally {
        client.close();
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Serveur FTP-Bridge opérationnel sur le port ${PORT}`);
});

// import express from 'express';
// import cors from 'cors';
// import fs from 'fs';
// import path from 'multer'; 
// // Assure-toi que multer est installé
// import multer from 'multer';

// const app = express();const PORT = 3000;

// // 1. CONFIGURATION DES ACCÈS (CORS)
// app.use(cors());
// app.use(express.json());

// // 2. CONFIGURATION DES CHEMINS (Basés sur le montage /data du Docker)
// // // Rappel : /data dans Docker = /volume1/ftp sur ton NAS
// const PATHS = {    camera: "/data/cam",    shared: "/data/shared_files"};

// // 3. VÉRIFICATION DES DOSSIERS AU DÉMARRAGE
// console.log(`📡 Point de montage NAS détecté : ${PATHS.shared}`);Object.entries(PATHS).forEach(([key, dir]) => {    if (!fs.existsSync(dir)) {        console.log(`⚠️ Dossier ${key} absent sur le NAS, création de : ${dir}`);        fs.mkdirSync(dir, { recursive: true });    }});

// // 4. CONFIGURATION DU STOCKAGE DES FICHIERS (Multer)
// const storage = multer.diskStorage({    destination: (req, file, cb) => {        
//     // On écrit directement dans /data/shared_files        
//     cb(null, PATHS.shared);    },    filename: (req, file, cb) => {        
//         // On garde le nom d'origine avec un timestamp pour éviter les doublons        
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);        cb(null, uniqueSuffix + '-' + file.originalname);    }});const upload = multer({ storage: storage });
    
// // 5. ROUTES API
// // Route d'upload
// app.post('/api/upload', upload.single('file'), (req, res) => {    if (!req.file) {        return res.status(400).json({ error: "Aucun fichier reçu." });    }    console.log(`✅ Fichier sauvegardé avec succès dans : ${req.file.path}`);    res.status(201).json({         message: "Fichier écrit sur le NAS !",        path: req.file.path     });});
// // Route pour lister les fichiers partagés
// app.get('/api/files/shared', (req, res) => {    try {        const files = fs.readdirSync(PATHS.shared);        res.json(files.map(f => ({ name: f })));    } catch (err) {        console.error("❌ Erreur lecture NAS:", err);        res.status(500).json({ error: "Impossible de lire le dossier sur le NAS" });    }});
// // Route de santé pour le tunnel Cloudflare
// app.get('/api/health', (req, res) => {    res.status(200).send('OK');});
// // 6. LANCEMENT DU SERVEUR
// app.listen(PORT, () => {    console.log(`🚀 Serveur backend opérationnel sur le port ${PORT}`);    console.log(`📂 Caméras attendues dans : ${PATHS.camera}`);    console.log(`📂 Partages attendus dans : ${PATHS.shared}`);});
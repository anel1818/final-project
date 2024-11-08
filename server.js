// Import dependencies
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { create } from 'ipfs-http-client';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { Readable } from 'stream';
import fetch from 'node-fetch';

const MONGO_URI = "mongodb+srv://admin:1234@cluster0.89qvg48.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
const JWT_SECRET = "tf4dcjpDioVF159+P7MWWosQat0rC67Ae9iSX1Daa0JQQ/SO0uRyaUwzmW3+AtoOMOugtoFZ3TV8c1JrNAkMyw==";
const PORT = 3000;

// Resolve __dirname for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize encryption constants
const ENCRYPTION_KEY = crypto.randomBytes(32); // 256-bit key
const IV_LENGTH = 16; // For AES, this is 16 bytes
const CHUNK_SIZE = 512 * 1024; // 512 KB

// Encrypt a buffer
function encrypt(buffer) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(buffer);
    encrypted = Buffer.concat([iv, encrypted, cipher.final()]);
    return encrypted;
}

// Decrypt a buffer
function decrypt(buffer) {
    const iv = buffer.slice(0, IV_LENGTH);
    const encryptedData = buffer.slice(IV_LENGTH);
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted;
}

// Initialize Express app
const app = express();
app.use(express.json());
app.use(cookieParser());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

// Serve 'index.html' at the root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB'))
    .catch((error) => console.error('MongoDB connection error:', error));

// Define User schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    files: [
        {
            fileName: { type: String, required: true },
            mimeType: { type: String, required: true },
            uploadDate: { type: Date, default: Date.now },
            chunks: [
                {
                    ipfsPath: { type: String, required: true },
                    chunkIndex: { type: Number, required: true },
                    chunkSize: { type: Number, required: true }
                }
            ]
        }
    ]
});

// Hash the password before saving the user
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.comparePassword = async function (inputPassword) {
    return await bcrypt.compare(inputPassword, this.password);
};

const User = mongoose.model('User', userSchema);

// Initialize IPFS client with error handling
let ipfs;
try {
    ipfs = create({ host: '127.0.0.1', port: 5001, protocol: 'http' });
    console.log('Connected to IPFS');
} catch (error) {
    console.error('IPFS connection error:', error);
}

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized: No token provided' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Forbidden: Invalid token' });
        req.user = user;
        next();
    });
}

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB limit

// Upload and fragment the file, saving metadata in MongoDB
app.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

        const fileBuffer = fs.readFileSync(req.file.path);
        const chunks = [];

        // Fragment and encrypt each chunk
        for (let i = 0; i < fileBuffer.length; i += CHUNK_SIZE) {
            const chunk = fileBuffer.slice(i, i + CHUNK_SIZE);
            const encryptedChunk = encrypt(chunk);

            const fileStream = new Readable();
            fileStream._read = () => {};
            fileStream.push(encryptedChunk);
            fileStream.push(null);

            const result = await ipfs.add(fileStream);
            if (!result || !result.path) {
                console.error("Failed to upload chunk to IPFS");
                return res.status(500).json({ success: false, message: 'IPFS upload failed' });
            }

            chunks.push({
                ipfsPath: `https://ipfs.io/ipfs/${result.path}`,
                chunkIndex: chunks.length,
                chunkSize: encryptedChunk.length
            });
            console.log(`Chunk ${chunks.length} encrypted and uploaded with CID: ${result.path}`);
        }

        const fileData = {
            fileName: req.file.originalname,
            mimeType: req.file.mimetype,
            uploadDate: new Date(),
            chunks
        };

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        user.files.push(fileData);
        await user.save();

        res.json({ success: true, message: 'File fragmented, encrypted, and uploaded successfully', fileData });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ success: false, message: 'File upload failed', error: error.message });
    }
});

// Helper function to fetch chunks from IPFS
async function fetchIPFS(ipfsPath) {
    const response = await fetch(ipfsPath);
    if (!response.ok) throw new Error(`Failed to fetch chunk from IPFS: ${response.statusText}`);
    return Buffer.from(await response.arrayBuffer());
}

// Endpoint to download and reassemble files
app.get('/download/:fileId', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const file = user.files.id(req.params.fileId);

        if (!file) {
            console.error("File not found in user's records");
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        const fileChunks = [];

        // Retrieve and decrypt each chunk in order
        for (const chunkData of file.chunks) {
            console.log(`Fetching chunk from IPFS at ${chunkData.ipfsPath}`);
            const encryptedChunkBuffer = await fetchIPFS(chunkData.ipfsPath);

            if (!encryptedChunkBuffer || encryptedChunkBuffer.length === 0) {
                console.error("Empty or invalid chunk received from IPFS");
                return res.status(500).json({ success: false, message: 'Failed to retrieve chunk from IPFS' });
            }

            const decryptedChunk = decrypt(encryptedChunkBuffer);
            fileChunks.push(decryptedChunk);
        }

        const reassembledFile = Buffer.concat(fileChunks);
        console.log("Reassembled file size:", reassembledFile.length);

        res.set({
            'Content-Type': file.mimeType,
            'Content-Disposition': `attachment; filename="${file.fileName}"`
        });
        res.send(reassembledFile);
    } catch (error) {
        console.error('Error downloading file:', error);
        res.status(500).json({ success: false, message: 'Failed to download file' });
    }
});

// Route for direct server-stored file access
app.get('/uploads/:fileName', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.fileName);
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) {
            console.error("File not found on server:", filePath);
            return res.status(404).json({ success: false, message: "File not found" });
        }
        res.sendFile(filePath);
    });
});

// User login endpoint
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true, secure: false, maxAge: 60 * 60 * 1000 });
        res.json({ success: true, message: 'Login successful' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// Logout endpoint
app.post('/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ success: true, message: 'Logout successful' });
});

// User registration endpoint
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    try {
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(409).json({ success: false, message: 'Username already taken' });

        const user = new User({ username, password });
        await user.save();

        res.json({ success: true, message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

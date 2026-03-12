require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const { extractConcepts, generateMCQs, generateSubjectiveQA, generateMindMap, generateYouTubeQueries, analyzeImage, generateAllStudyMaterials } = require('./ai_engine');
const officeParser = require('officeparser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const uploadDir = process.env.VERCEL ? '/tmp' : 'uploads/';
const upload = multer({ dest: uploadDir });

app.post('/api/upload', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        console.log(`Processing document: ${req.file.originalname}`);

        let extractedText = "";
        if (req.file.mimetype === 'application/pdf') {
            const dataBuffer = await fs.promises.readFile(req.file.path);
            const pdfData = await pdfParse(dataBuffer);
            extractedText = pdfData.text;
        } else if (req.file.mimetype.startsWith('image/')) {
            extractedText = await analyzeImage(req.file.path, req.file.mimetype);
        } else if (req.file.mimetype.startsWith('text/') || req.file.mimetype.includes('json') || req.file.originalname.match(/\.(txt|md|js|json|html|css|csv)$/i)) {
            extractedText = await fs.promises.readFile(req.file.path, 'utf8');
        } else if (req.file.originalname.match(/\.(pptx|docx|xlsx)$/i) || req.file.mimetype.includes('presentation') || req.file.mimetype.includes('document')) {
            const ext = path.extname(req.file.originalname) || '.pptx';
            // Use /tmp for tempPath inside Vercel
            const tempPath = process.env.VERCEL ? path.join('/tmp', req.file.filename + ext) : req.file.path + ext;
            await fs.promises.rename(req.file.path, tempPath);
            extractedText = await officeParser.parseOffice(tempPath);
        } else {
            return res.status(400).json({ error: 'Unsupported file type. Please upload a PDF, PPTX, DOCX, Image, or plain Text file.' });
        }

        const simulatedText = `[User Uploaded Content from ${req.file.originalname}]: ` + extractedText;

        const studyKit = await generateAllStudyMaterials(simulatedText);

        if (studyKit.error) {
            return res.status(500).json({ error: studyKit.error });
        }

        res.json({
            success: true,
            message: 'File ingested via Multer and AI processed.',
            data: studyKit
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'File extraction API failure' });
    }
});

app.post('/api/generate', async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Requires content payload' });

    try {
        console.log("Analyzing text via Gemini...");
        const studyKit = await generateAllStudyMaterials(content);

        if (studyKit.error) {
            return res.status(500).json({ error: studyKit.error });
        }

        res.json({
            success: true,
            data: studyKit
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Generation process failed' });
    }
});

app.get('/api/youtube-thumbnail', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json({ thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=200&auto=format&fit=crop' });

    try {
        const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`);
        const html = await response.text();

        // Very basic regex to find the first video ID in the raw HTML string
        const match = html.match(/"videoId":"([^"]{11})"/);

        if (match && match[1]) {
            const videoId = match[1];
            res.json({ thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` });
        } else {
            res.json({ thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=200&auto=format&fit=crop' });
        }
    } catch (e) {
        res.json({ thumbnail: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=200&auto=format&fit=crop' });
    }
});

app.listen(PORT, () => console.log(`Backend Server API Live at http://localhost:${PORT}`));

module.exports = app;

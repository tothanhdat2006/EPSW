import * as Minio from 'minio';
import PDFDocument from 'pdfkit';
import { prisma } from '@dvc/database';
import { createLogger } from '@dvc/logger';
import { config } from '../config.js';

const logger = createLogger({ service: 'workflow-engine' });

let minioClient: Minio.Client | null = null;

function getMinioClient(): Minio.Client {
  if (!minioClient) {
    minioClient = new Minio.Client({
      endPoint: config.minio.endPoint,
      port: config.minio.port,
      useSSL: config.minio.useSSL,
      accessKey: config.minio.accessKey,
      secretKey: config.minio.secretKey,
    });
  }
  return minioClient;
}

export async function generateFinalPdf(
  documentId: string,
  correlationId: string,
): Promise<string> {
  logger.info({ documentId, correlationId }, 'Generating final PDF');

  const docData = await prisma.document.findUnique({ where: { id: documentId } });
  if (!docData) throw new Error('Document not found');

  const trackingCode = docData.trackingCode;
  const bucketName = process.env['MINIO_BUCKET_PUBLISHED'] ?? 'dvc-published';
  const objectKey = `${documentId}/QUYET_DINH_${trackingCode}.pdf`;

  // Ensure bucket exists
  const client = getMinioClient();
  const exists = await client.bucketExists(bucketName).catch(() => false);
  if (!exists) {
    await client.makeBucket(bucketName, 'us-east-1').catch((err) => {
      logger.warn({ err }, 'Could not create bucket (it might already exist)');
    });
  }

  // Create a simple PDF using pdfkit
  return new Promise((resolve, reject) => {
    const buffers: Buffer[] = [];
    const pdfDoc = new PDFDocument();

    pdfDoc.on('data', buffers.push.bind(buffers));
    pdfDoc.on('end', async () => {
      try {
        const fileBuffer = Buffer.concat(buffers);
        await client.putObject(bucketName, objectKey, fileBuffer, fileBuffer.length, {
          'Content-Type': 'application/pdf',
        });

        const url = `http://${process.env['MINIO_ENDPOINT'] ?? 'localhost'}:${process.env['MINIO_PORT'] ?? '9000'}/${bucketName}/${objectKey}`;
        resolve(url);
      } catch (err) {
        logger.error({ err }, 'Failed to upload PDF to MinIO');
        reject(err);
      }
    });

    // Content of the PDF
    pdfDoc.fontSize(20).text('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { align: 'center' });
    pdfDoc.fontSize(16).text('Độc lập - Tự do - Hạnh phúc', { align: 'center' });
    pdfDoc.moveDown();
    pdfDoc.fontSize(18).text('QUYẾT ĐỊNH PHÊ DUYỆT', { align: 'center' });
    pdfDoc.moveDown();

    pdfDoc.fontSize(12).text(`Mã số hồ sơ: ${trackingCode}`);
    pdfDoc.text(`Người nộp: ${docData.submitterId}`);
    pdfDoc.text(`Ngày cấp: ${new Date().toLocaleDateString('vi-VN')}`);
    pdfDoc.text(`Tình trạng hồ sơ: ĐÃ ĐƯỢC PHÊ DUYỆT`);
    pdfDoc.moveDown();

    const exData = (docData.extractedData as Record<string, unknown>) || {};
    if (exData['executiveSummary'] && Array.isArray(exData['executiveSummary'])) {
      pdfDoc.text('Tóm tắt nội dung giải quyết:');
      pdfDoc.moveDown(0.5);
      for (const bullet of exData['executiveSummary']) {
        pdfDoc.text(`• ${bullet}`);
      }
    }

    pdfDoc.moveDown(2);
    pdfDoc.text('CHỮ KÝ VÀ ĐÓNG DẤU (BẢN ĐIỆN TỬ)', { align: 'right' });
    pdfDoc.text('Bởi: Quản lý / Lãnh đạo', { align: 'right' });

    pdfDoc.end();
  });
}

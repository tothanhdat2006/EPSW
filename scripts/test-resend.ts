import { emailService } from '../app/src/lib/server/email-service';
import * as dotenv from 'dotenv';
dotenv.config({ path: './app/.env' });

async function runTest() {
    const testEmail = process.argv[2] || 'test@example.com';
    console.log(`🚀 Sending test "Received" email to ${testEmail}...`);
    
    const result = await emailService.notifyDocumentReceived(testEmail, 'Người Dân Demo', 'DVC-2026-TEST-123');
    
    if (result.success) {
        console.log('✅ Email sent successfully!', result.data);
    } else {
        console.error('❌ Failed to send email:', result.error);
    }
}

runTest();

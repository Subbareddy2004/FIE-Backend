const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

const sendRegistrationPendingEmail = async (recipientEmail, data) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: recipientEmail,
        subject: `Registration Pending - ${data.eventName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #2563eb;">Registration Pending for ${data.eventName}</h2>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #374151; margin-top: 0;">Registration Details:</h3>
                    <ul style="list-style: none; padding: 0;">
                        <li style="margin: 10px 0;">Team Name: <strong>${data.teamName}</strong></li>
                        <li style="margin: 10px 0;">Event: <strong>${data.eventName}</strong></li>
                        ${data.paymentStatus !== 'not_required' ? `
                            <li style="margin: 10px 0;">Transaction ID: <strong>${data.transactionId}</strong></li>
                            <li style="margin: 10px 0;">Amount: <strong>₹${data.amount}</strong></li>
                            <li style="margin: 10px 0;">Status: <strong>Pending Verification</strong></li>
                        ` : ''}
                    </ul>
                </div>

                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #374151; margin-top: 0;">Team Members:</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background-color: #e5e7eb;">
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Name</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Role</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Register No.</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Contact</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.members.map(member => `
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 12px;">${member.name}</td>
                                    <td style="padding: 12px;">${member.isLeader ? 'Team Leader' : 'Member'}</td>
                                    <td style="padding: 12px;">${member.registerNumber}</td>
                                    <td style="padding: 12px;">
                                        ${member.email}<br>
                                        ${member.mobileNumber}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                ${data.paymentStatus !== 'not_required' ? `
                    <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #9a3412;">
                            Your registration is pending payment verification. We will notify you once the verification is complete.
                        </p>
                    </div>
                ` : `
                    <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #166534;">
                            Your registration is confirmed! No payment was required for this event.
                        </p>
                    </div>
                `}

                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <h3 style="color: #374151; margin-top: 0;">Event Manager Contact</h3>
                    <p style="margin: 0; color: #4b5563;">
                        For any queries, please contact the event manager:
                    </p>
                    <ul style="list-style: none; padding: 0; margin: 10px 0;">
                        <li style="margin: 5px 0;">
                            <strong>Organization:</strong> ${data.eventManager?.organization || 'Not specified'}
                        </li>
                        <li style="margin: 5px 0;">
                            <strong>Email:</strong> ${data.eventManager?.email || 'Not specified'}
                        </li>
                        <li style="margin: 5px 0;">
                            <strong>Phone:</strong> ${data.eventManager?.phone || 'Not specified'}
                        </li>
                    </ul>
                </div>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px;">
                        Best regards,<br>
                        Event Management Team
                    </p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending registration pending email:', error);
        throw error;
    }
};

const sendPaymentVerificationEmail = async (recipientEmail, data) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: recipientEmail,
        subject: data.status === 'verified' 
            ? `Registration Confirmed - ${data.eventName}`
            : `Registration Rejected - ${data.eventName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: ${data.status === 'verified' ? '#16a34a' : '#dc2626'};">
                    Registration ${data.status === 'verified' ? 'Confirmed' : 'Rejected'} for ${data.eventName}
                </h2>
                
                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #374151; margin-top: 0;">Registration Details:</h3>
                    <ul style="list-style: none; padding: 0;">
                        <li style="margin: 10px 0;">Team Name: <strong>${data.teamName}</strong></li>
                        <li style="margin: 10px 0;">Event: <strong>${data.eventName}</strong></li>
                        <li style="margin: 10px 0;">Transaction ID: <strong>${data.transactionId}</strong></li>
                        <li style="margin: 10px 0;">Amount: <strong>₹${data.amount}</strong></li>
                        <li style="margin: 10px 0;">Status: <strong>${
                            data.status === 'verified' ? 'Confirmed' : 'Rejected'
                        }</strong></li>
                    </ul>
                </div>

                <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #374151; margin-top: 0;">Team Members:</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background-color: #e5e7eb;">
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Name</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Role</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Register No.</th>
                                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Contact</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.members.map(member => `
                                <tr style="border-bottom: 1px solid #e5e7eb;">
                                    <td style="padding: 12px;">${member.name}</td>
                                    <td style="padding: 12px;">${member.isLeader ? 'Team Leader' : 'Member'}</td>
                                    <td style="padding: 12px;">${member.registerNumber}</td>
                                    <td style="padding: 12px;">
                                        ${member.email}<br>
                                        ${member.mobileNumber}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                ${data.status === 'verified' ? `
                    <div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #166534;">
                            Your payment has been verified and your registration is now confirmed!
                        </p>
                    </div>
                ` : `
                    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
                        <p style="margin: 0; color: #991b1b;">
                            Your payment could not be verified. Reason: ${data.notes || 'Payment verification failed'}
                        </p>
                    </div>
                `}

                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
                    <h3 style="color: #374151; margin-top: 0;">Event Manager Contact</h3>
                    <p style="margin: 0; color: #4b5563;">
                        For any queries, please contact the event manager:
                    </p>
                    <ul style="list-style: none; padding: 0; margin: 10px 0;">
                        <li style="margin: 5px 0;">
                            <strong>Organization:</strong> ${data.eventManager?.organization || 'Not specified'}
                        </li>
                        <li style="margin: 5px 0;">
                            <strong>Email:</strong> ${data.eventManager?.email || 'Not specified'}
                        </li>
                        <li style="margin: 5px 0;">
                            <strong>Phone:</strong> ${data.eventManager?.phone || 'Not specified'}
                        </li>
                    </ul>
                </div>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <p style="color: #6b7280; font-size: 14px;">
                        Best regards,<br>
                        Event Management Team
                    </p>
                </div>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending payment verification email:', error);
        throw error;
    }
};

module.exports = {
    sendRegistrationPendingEmail,
    sendPaymentVerificationEmail
};

import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const lastUpdated = 'June 5, 2026';

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <img src="/crew-compass-logo.png?v=2" alt="Crew Compass" className="h-10 w-auto" />
            </div>
            <h1 className="text-2xl font-bold">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
          </div>
        </div>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section>
            <h2 className="text-lg font-semibold mb-2">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Summit Facilities Group ("we," "our," or "us") operates the Crew Compass mobile and web application
              (the "App"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information
              when you use our App. By using Crew Compass, you agree to the collection and use of information in
              accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">We collect the following types of information:</p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li><strong>Account Information:</strong> Name, email address, job title, employee ID, and profile photo provided during account creation or onboarding.</li>
              <li><strong>Location Data:</strong> GPS coordinates when you clock in or out of a shift, if geofencing is enabled for your account. Location is only collected at the moment of clock-in/out and is not tracked continuously.</li>
              <li><strong>Work Records:</strong> Time clock entries, schedule assignments, time-off requests, and attendance records.</li>
              <li><strong>Onboarding Documents:</strong> Information entered into digital forms (W-4, I-9, Direct Deposit) and digital signatures.</li>
              <li><strong>Communications:</strong> Messages sent through the in-app messaging system.</li>
              <li><strong>Photos and Files:</strong> Images and documents uploaded during quality control inspections, work orders, or messages.</li>
              <li><strong>Device Information:</strong> Device type, operating system, and app version for troubleshooting purposes.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li>Provide, operate, and maintain the Crew Compass application</li>
              <li>Process time clock entries and verify location for geofenced job sites</li>
              <li>Manage employee scheduling, time-off requests, and attendance</li>
              <li>Store and process onboarding documentation</li>
              <li>Enable communication between employees and managers</li>
              <li>Generate quality control inspection reports</li>
              <li>Comply with applicable employment and tax laws</li>
              <li>Improve and troubleshoot the App</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">4. Location Data</h2>
            <p className="text-muted-foreground leading-relaxed">
              If your employer has enabled geofencing, the App will request access to your device's location when
              you attempt to clock in or out. Location data is used solely to verify that you are within the
              designated work area. We do <strong>not</strong> track your location continuously, in the background,
              or outside of clock-in/out events. You may disable location access in your device settings, but this
              may prevent you from clocking in at geofenced locations.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">5. Data Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              We do not sell, trade, or rent your personal information to third parties. We may share your
              information in the following limited circumstances:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li><strong>With your employer:</strong> Your work records, schedules, and onboarding documents are accessible to authorized managers and administrators within your organization.</li>
              <li><strong>Service Providers:</strong> We use Supabase for secure data storage and authentication. These providers are contractually obligated to protect your data.</li>
              <li><strong>Legal Requirements:</strong> We may disclose information if required by law or in response to valid legal process.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">6. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement industry-standard security measures including encrypted data transmission (HTTPS/TLS),
              encrypted data storage, and role-based access controls to protect your personal information. However,
              no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">7. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal information for as long as your account is active or as needed to provide
              services. Work records and onboarding documents may be retained for the period required by applicable
              employment laws. You may request deletion of your account and associated data at any time (see
              Section 9 below).
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">8. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Crew Compass is intended for use by adults in a professional employment context. We do not knowingly
              collect personal information from individuals under the age of 16. If we become aware that a minor
              has provided us with personal information, we will take steps to delete such information.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">9. Your Rights and Account Deletion</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">You have the right to:</p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you.</li>
              <li><strong>Correction:</strong> Request correction of inaccurate personal information.</li>
              <li><strong>Deletion:</strong> Request deletion of your account and personal data. You can delete your account directly from the app by going to your profile menu and selecting "Delete My Account." This action is permanent and cannot be undone.</li>
              <li><strong>Portability:</strong> Request an export of your personal data in a machine-readable format.</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              To exercise these rights, contact us at the email address below or use the in-app account deletion feature.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">10. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by updating
              the "Last updated" date at the top of this page. We encourage you to review this policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-2">11. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="mt-3 p-4 bg-muted rounded-lg">
              <p className="font-medium">Summit Facilities Group</p>
              <p className="text-muted-foreground text-sm">Crew Compass Support</p>
              <p className="text-muted-foreground text-sm">Email: privacy@summitfacilitiesgroup.com</p>
            </div>
          </section>
        </div>

        <div className="mt-8 pt-6 border-t text-center">
          <img src="/crew-compass-logo.png?v=2" alt="Crew Compass" className="h-10 w-auto mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Summit Facilities Group. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;

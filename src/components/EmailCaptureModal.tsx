import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { emailService } from '../services/email';
import type { SubscriptionIncentive } from '../services/email';
import { toast } from 'sonner';

type ModalMode = 'join' | 'manage';

type IncentiveOption = 'discount' | 'care_kit';

type EmailCaptureModalProps = {
  open: boolean;
  mode?: ModalMode;
  initialEmail?: string;
  onOpenChange: (open: boolean) => void;
};

const INCENTIVE_DETAILS: Record<IncentiveOption, SubscriptionIncentive> = {
  discount: {
    type: 'discount_code',
    description: 'Receive a 15% code for your first marketplace order when we launch.',
    value: '15%',
  },
  care_kit: {
    type: 'care_kit',
    description: 'Claim a propagation care kit shipped with your first qualifying purchase.',
  },
};

export function EmailCaptureModal({ open, mode = 'join', initialEmail, onOpenChange }: EmailCaptureModalProps) {
  const [activeMode, setActiveMode] = useState<ModalMode>(mode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [gdprAccepted, setGdprAccepted] = useState(false);
  const [incentive, setIncentive] = useState<IncentiveOption>('discount');
  const [unsubscribeReason, setUnsubscribeReason] = useState('');
  const [requestErasure, setRequestErasure] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverMessage, setServerMessage] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setActiveMode(mode);
      setEmail(initialEmail ?? '');
      setServerMessage(null);
      setIsSubmitting(false);
      setConsentAccepted(false);
      setGdprAccepted(false);
      setRequestErasure(false);
      setUnsubscribeReason('');
    }
  }, [open, mode, initialEmail]);

  const incentiveCopy = useMemo(() => INCENTIVE_DETAILS[incentive], [incentive]);

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setConsentAccepted(false);
    setGdprAccepted(false);
    setServerMessage(null);
  };

  const handleJoin = async () => {
    if (!email.trim()) {
      throw new Error('Please provide an email address to join the list.');
    }

    if (!consentAccepted || !gdprAccepted) {
      throw new Error('Please grant marketing consent and acknowledge GDPR processing to join the list.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const consentTimestamp = new Date().toISOString();

    const response = await emailService.subscribeToMarketingList({
      email: normalizedEmail,
      fullName: fullName.trim() || undefined,
      source: 'waitlist-modal',
      tags: ['waitlist', 'modal'],
      incentives: [incentiveCopy],
      consent: {
        email: normalizedEmail,
        marketingConsent: true,
        gdprConsent: true,
        consentAt: consentTimestamp,
        consentSource: 'waitlist-modal',
        metadata: {
          incentive,
        },
      },
      metadata: {
        incentive,
      },
    });

    await emailService.sendLifecycleEmail('waitlist_confirmation', {
      email: normalizedEmail,
      firstName: fullName.trim().split(' ')[0] || undefined,
      incentive,
      channel: 'modal',
    });

    setServerMessage(response.message ?? 'You are officially on the list!');
    toast.success(response.message ?? 'We saved your email – perks are on the way!');
    resetForm();
  };

  const handleUnsubscribe = async () => {
    if (!email.trim()) {
      throw new Error('Enter the email you would like to remove.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const response = await emailService.unsubscribe({
      email: normalizedEmail,
      reason: unsubscribeReason.trim() || undefined,
      gdprDelete: requestErasure,
      consentSource: 'preferences-modal',
    });

    setServerMessage(response.message ?? 'Your email preferences have been updated.');
    toast.success(response.message ?? 'Your preferences are updated.');
    resetForm();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setServerMessage(null);

    try {
      if (activeMode === 'join') {
        await handleJoin();
      } else {
        await handleUnsubscribe();
      }
      onOpenChange(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.';
      toast.error(message);
      setServerMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderJoinForm = () => (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="waitlist-full-name">Full name</Label>
        <Input
          id="waitlist-full-name"
          placeholder="Taylor Morgan"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="waitlist-email">Email address</Label>
        <Input
          id="waitlist-email"
          type="email"
          placeholder="you@plantmail.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Choose your launch perk</p>
        <RadioGroup value={incentive} onValueChange={(value) => setIncentive(value as IncentiveOption)}>
          {Object.entries(INCENTIVE_DETAILS).map(([key, option]) => (
            <Label
              key={key}
              htmlFor={`waitlist-perk-${key}`}
              className="cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground transition hover:border-emerald-500 hover:bg-muted"
            >
              <RadioGroupItem
                id={`waitlist-perk-${key}`}
                value={key}
                className="mt-1 border-emerald-500 text-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-emerald-950"
              />
              <span className="space-y-1">
                <span className="block font-medium text-foreground">{option.type === 'discount_code' ? '15% launch discount' : 'Propagation care kit'}</span>
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </div>
      <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
        <div className="flex items-start gap-3">
          <Checkbox
            id="waitlist-consent"
            checked={consentAccepted}
            onCheckedChange={(checked) => setConsentAccepted(checked === true)}
            className="mt-1 border-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-emerald-950"
          />
          <Label htmlFor="waitlist-consent" className="cursor-pointer items-start text-xs text-muted-foreground">
            I agree to receive Thumr waitlist updates and launch offers.
          </Label>
        </div>
        <div className="flex items-start gap-3">
          <Checkbox
            id="waitlist-gdpr"
            checked={gdprAccepted}
            onCheckedChange={(checked) => setGdprAccepted(checked === true)}
            className="mt-1 border-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-emerald-950"
          />
          <Label htmlFor="waitlist-gdpr" className="cursor-pointer items-start text-xs text-muted-foreground">
            I consent to Thumr storing my information for the purpose of delivering the selected perk and newsletters. I can
            unsubscribe at any time.
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          We timestamp consent and include an unsubscribe link in every message.
        </p>
      </div>
    </div>
  );

  const renderManageForm = () => (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="waitlist-manage-email">Email address</Label>
        <Input
          id="waitlist-manage-email"
          type="email"
          placeholder="you@plantmail.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="waitlist-manage-reason">Tell us why (optional)</Label>
        <Textarea
          id="waitlist-manage-reason"
          placeholder="Too many emails, found plants elsewhere, etc."
          value={unsubscribeReason}
          onChange={(event) => setUnsubscribeReason(event.target.value)}
          rows={3}
        />
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
        <Checkbox
          id="waitlist-manage-erasure"
          checked={requestErasure}
          onCheckedChange={(checked) => setRequestErasure(checked === true)}
          className="mt-1 border-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-emerald-950"
        />
        <Label htmlFor="waitlist-manage-erasure" className="cursor-pointer items-start text-xs text-muted-foreground">
          Request full data erasure in addition to unsubscribing.
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        We will email you a confirmation of your updated preferences for your records.
      </p>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-lg font-semibold text-foreground">
            {activeMode === 'join' ? 'Join the Thumr grower waitlist' : 'Manage email preferences'}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {activeMode === 'join'
              ? 'Claim launch-day perks, receive the weekly grower digest, and manage your consent in a single place.'
              : 'Update your consent settings or request removal. This will apply across newsletters and transactional emails.'}
          </DialogDescription>
        </DialogHeader>
        <div className="mb-4 flex items-center gap-2">
          <Button
            type="button"
            variant={activeMode === 'join' ? 'default' : 'outline'}
            onClick={() => setActiveMode('join')}
            className="flex-1"
          >
            Join waitlist
          </Button>
          <Button
            type="button"
            variant={activeMode === 'manage' ? 'default' : 'outline'}
            onClick={() => setActiveMode('manage')}
            className="flex-1"
          >
            Manage preferences
          </Button>
        </div>
        <form className="space-y-5" onSubmit={handleSubmit}>
          {activeMode === 'join' ? renderJoinForm() : renderManageForm()}
          {serverMessage && <p className="text-sm text-muted-foreground">{serverMessage}</p>}
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? activeMode === 'join'
                  ? 'Joining...'
                  : 'Updating...'
                : activeMode === 'join'
                  ? 'Join the waitlist'
                  : 'Update preferences'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

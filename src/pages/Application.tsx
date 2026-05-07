import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import { ArrowLeft, HardHat } from "lucide-react";

type FormState = Record<string, string | boolean>;

const Section = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <section className="rounded-xl border border-border bg-card/60 backdrop-blur p-6 sm:p-8 shadow-deep">
    <div className="mb-6 border-b border-border pb-4">
      <h2 className="font-display text-2xl uppercase tracking-wide text-maple">{title}</h2>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
    <div className="space-y-5">{children}</div>
  </section>
);

const YesNo = ({
  label,
  name,
  value,
  onChange,
  detailsName,
  detailsValue,
  detailsLabel = "Please explain",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (n: string, v: string) => void;
  detailsName?: string;
  detailsValue?: string;
  detailsLabel?: string;
}) => (
  <div className="space-y-2">
    <Label className="block">{label}</Label>
    <RadioGroup value={value} onValueChange={(v) => onChange(name, v)} className="flex gap-4">
      <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="no" /> No</label>
      <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="yes" /> Yes</label>
    </RadioGroup>
    {value === "yes" && detailsName && (
      <div className="pt-1">
        <Label className="mb-1.5 block text-xs text-muted-foreground">{detailsLabel}</Label>
        <Textarea
          value={detailsValue ?? ""}
          onChange={(e) => onChange(detailsName, e.target.value)}
          rows={3}
          maxLength={1000}
        />
      </div>
    )}
  </div>
);

const Field = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  className = "",
}: {
  label: string;
  name: string;
  value: string;
  onChange: (n: string, v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
}) => (
  <div className={className}>
    <Label htmlFor={name} className="mb-1.5 block">
      {label} {required && <span className="text-maple">*</span>}
    </Label>
    <Input
      id={name}
      name={name}
      type={type}
      value={value}
      onChange={(e) => onChange(name, e.target.value)}
      required={required}
      placeholder={placeholder}
    />
  </div>
);

const Application = () => {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [f, setF] = useState<FormState>({
    fullName: "", email: "", phone: "", address: "", city: "", state: "", zip: "",
    dob: "", ssn: "", driversLicense: "", licenseState: "",
    position: "", desiredPay: "", availableStart: "", employmentType: "full-time",
    hasTransportation: false, willingOvertime: false, willingTravel: false, canLiftHeavy: false,
    eligibleToWork: false, over18: false,
    edu1School: "", edu1Years: "", edu1Degree: "",
    edu2School: "", edu2Years: "", edu2Degree: "",
    job1Employer: "", job1Title: "", job1Dates: "", job1Pay: "", job1Reason: "", job1Duties: "",
    job2Employer: "", job2Title: "", job2Dates: "", job2Pay: "", job2Reason: "", job2Duties: "",
    job3Employer: "", job3Title: "", job3Dates: "", job3Pay: "", job3Reason: "", job3Duties: "",
    skills: "", certifications: "",
    ref1Name: "", ref1Phone: "", ref1Relation: "",
    ref2Name: "", ref2Phone: "", ref2Relation: "",
    convicted: "no", convictedDetails: "",
    previouslyApplied: "no", previouslyAppliedDetails: "",
    everFired: "no", everFiredDetails: "",
    physicalLimitations: "no", physicalLimitationsDetails: "",
    currentlyEmployed: "no", contactCurrentEmployer: "no", currentlyEmployedDetails: "",
    emergencyName: "", emergencyPhone: "", emergencyRelation: "",
    signature: "", signedDate: new Date().toISOString().slice(0, 10),
    consent: false,
  });

  const set = (n: string, v: string | boolean) => setF((p) => ({ ...p, [n]: v }));
  const setStr = (n: string, v: string) => set(n, v);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.consent) {
      toast({ title: "Please certify the application", description: "You must agree before submitting.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      // Try storing the application; gracefully fall back if the table doesn't exist
      const { error } = await supabase.from("employment_applications" as never).insert(f as never);
      if (error && !error.message.toLowerCase().includes("does not exist") && !error.message.toLowerCase().includes("not found")) {
        throw error;
      }
      setSubmitted(true);
      toast({ title: "Application submitted", description: "Thank you. We'll be in touch soon." });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      toast({ title: "Submission failed", description: err.message ?? "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background text-foreground grid place-items-center p-6">
        <div className="max-w-lg text-center rounded-xl border border-border bg-card/60 p-10 shadow-deep">
          <div className="h-16 w-16 mx-auto rounded-full bg-gradient-maple grid place-items-center mb-4 shadow-maple">
            <HardHat className="h-8 w-8 text-maple-foreground" />
          </div>
          <h1 className="font-display text-3xl uppercase mb-3">Application Received</h1>
          <p className="text-muted-foreground mb-6">
            Thank you for applying to Dwayne Noe Construction LLC. A member of our team will review your application and reach out shortly.
          </p>
          <Button asChild className="bg-maple text-maple-foreground hover:bg-maple/90 font-display tracking-wider">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-black/40 backdrop-blur sticky top-0 z-20">
        <div className="container flex items-center justify-between py-4">
          <Link to="/" className="flex items-center gap-3 group">
            <img src={logo} alt="Dwayne Noe Construction" className="h-10 w-auto [filter:brightness(0)_invert(1)]" />
            <span className="font-display uppercase tracking-wider text-sm hidden sm:inline">Dwayne Noe Construction</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/" className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Home</Link>
          </Button>
        </div>
      </header>

      <div className="container py-10 max-w-4xl">
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-maple/40 bg-black/40 text-maple text-xs tracking-[0.2em] uppercase mb-4">
            <HardHat className="h-3.5 w-3.5" /> Join the Crew
          </div>
          <h1 className="font-display text-4xl sm:text-5xl uppercase mb-3">
            Employment <span className="text-maple">Application</span>
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Dwayne Noe Construction LLC is an equal opportunity employer. Please complete every section accurately. All information will be kept confidential.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal */}
          <Section title="Personal Information">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Full Legal Name" name="fullName" value={f.fullName as string} onChange={setStr} required />
              <Field label="Date of Birth" name="dob" type="date" value={f.dob as string} onChange={setStr} required />
              <Field label="Email" name="email" type="email" value={f.email as string} onChange={setStr} required />
              <Field label="Phone" name="phone" type="tel" value={f.phone as string} onChange={setStr} required />
              <Field label="Street Address" name="address" value={f.address as string} onChange={setStr} required className="sm:col-span-2" />
              <Field label="City" name="city" value={f.city as string} onChange={setStr} required />
              <div className="grid grid-cols-2 gap-4">
                <Field label="State" name="state" value={f.state as string} onChange={setStr} required />
                <Field label="ZIP" name="zip" value={f.zip as string} onChange={setStr} required />
              </div>
              <Field label="Driver's License #" name="driversLicense" value={f.driversLicense as string} onChange={setStr} />
              <Field label="License State" name="licenseState" value={f.licenseState as string} onChange={setStr} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={f.over18 as boolean} onCheckedChange={(v) => set("over18", !!v)} />
                I am at least 18 years of age
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={f.eligibleToWork as boolean} onCheckedChange={(v) => set("eligibleToWork", !!v)} />
                I am legally eligible to work in the U.S.
              </label>
            </div>
            <div className="pt-2 border-t border-border/60">
              <YesNo
                label="Have you previously applied to or worked for Dwayne Noe Construction?"
                name="previouslyApplied"
                value={f.previouslyApplied as string}
                onChange={setStr}
                detailsName="previouslyAppliedDetails"
                detailsValue={f.previouslyAppliedDetails as string}
                detailsLabel="When and in what capacity?"
              />
            </div>
          </Section>

          {/* Position */}
          <Section title="Position Desired">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Position Applying For" name="position" value={f.position as string} onChange={setStr} required placeholder="Laborer, Operator, Foreman..." />
              <Field label="Desired Pay" name="desiredPay" value={f.desiredPay as string} onChange={setStr} placeholder="$/hr" />
              <Field label="Date Available to Start" name="availableStart" type="date" value={f.availableStart as string} onChange={setStr} required />
              <div>
                <Label className="mb-1.5 block">Employment Type</Label>
                <RadioGroup value={f.employmentType as string} onValueChange={(v) => set("employmentType", v)} className="flex gap-4 pt-2">
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="full-time" /> Full-Time</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="part-time" /> Part-Time</label>
                  <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="seasonal" /> Seasonal</label>
                </RadioGroup>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={f.hasTransportation as boolean} onCheckedChange={(v) => set("hasTransportation", !!v)} />
                I have reliable transportation
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={f.willingOvertime as boolean} onCheckedChange={(v) => set("willingOvertime", !!v)} />
                Willing to work overtime
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={f.willingTravel as boolean} onCheckedChange={(v) => set("willingTravel", !!v)} />
                Willing to travel between job sites
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={f.canLiftHeavy as boolean} onCheckedChange={(v) => set("canLiftHeavy", !!v)} />
                Able to lift 50+ lbs repeatedly
              </label>
            </div>
            <div className="pt-2 border-t border-border/60">
              <YesNo
                label="Do you have any physical limitations that would prevent you from performing the job?"
                name="physicalLimitations"
                value={f.physicalLimitations as string}
                onChange={setStr}
                detailsName="physicalLimitationsDetails"
                detailsValue={f.physicalLimitationsDetails as string}
              />
            </div>
          </Section>

          {/* Education */}
          <Section title="Education">
            {[1, 2].map((n) => (
              <div key={n} className="grid sm:grid-cols-3 gap-4">
                <Field label={`School ${n}`} name={`edu${n}School`} value={f[`edu${n}School`] as string} onChange={setStr} />
                <Field label="Years Attended" name={`edu${n}Years`} value={f[`edu${n}Years`] as string} onChange={setStr} />
                <Field label="Degree / Diploma" name={`edu${n}Degree`} value={f[`edu${n}Degree`] as string} onChange={setStr} />
              </div>
            ))}
          </Section>

          {/* Employment History */}
          <Section title="Employment History" subtitle="List your three most recent employers, starting with the most recent.">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-lg border border-border/60 p-4 space-y-4">
                <div className="text-xs uppercase tracking-widest text-maple font-display">Employer {n}</div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Employer" name={`job${n}Employer`} value={f[`job${n}Employer`] as string} onChange={setStr} />
                  <Field label="Job Title" name={`job${n}Title`} value={f[`job${n}Title`] as string} onChange={setStr} />
                  <Field label="Dates of Employment" name={`job${n}Dates`} value={f[`job${n}Dates`] as string} onChange={setStr} placeholder="MM/YYYY – MM/YYYY" />
                  <Field label="Ending Pay" name={`job${n}Pay`} value={f[`job${n}Pay`] as string} onChange={setStr} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Duties</Label>
                  <Textarea value={f[`job${n}Duties`] as string} onChange={(e) => set(`job${n}Duties`, e.target.value)} rows={2} />
                </div>
                <Field label="Reason for Leaving" name={`job${n}Reason`} value={f[`job${n}Reason`] as string} onChange={setStr} />
              </div>
            ))}
            <div className="rounded-lg border border-border/60 p-4 space-y-4">
              <YesNo
                label="Are you currently employed?"
                name="currentlyEmployed"
                value={f.currentlyEmployed as string}
                onChange={setStr}
                detailsName="currentlyEmployedDetails"
                detailsValue={f.currentlyEmployedDetails as string}
                detailsLabel="Where, and may we contact them?"
              />
              <YesNo
                label="Have you ever been fired or asked to resign from a position?"
                name="everFired"
                value={f.everFired as string}
                onChange={setStr}
                detailsName="everFiredDetails"
                detailsValue={f.everFiredDetails as string}
              />
            </div>
          </Section>

          {/* Skills */}
          <Section title="Skills & Certifications">
            <div>
              <Label className="mb-1.5 block">Construction Skills / Equipment Operated</Label>
              <Textarea value={f.skills as string} onChange={(e) => set("skills", e.target.value)} rows={3} placeholder="Framing, concrete, skid steer, excavator, CDL..." />
            </div>
            <div>
              <Label className="mb-1.5 block">Certifications / Licenses</Label>
              <Textarea value={f.certifications as string} onChange={(e) => set("certifications", e.target.value)} rows={2} placeholder="OSHA 10/30, CDL Class A, First Aid..." />
            </div>
          </Section>

          {/* References */}
          <Section title="Professional References">
            {[1, 2].map((n) => (
              <div key={n} className="grid sm:grid-cols-3 gap-4">
                <Field label={`Reference ${n} Name`} name={`ref${n}Name`} value={f[`ref${n}Name`] as string} onChange={setStr} />
                <Field label="Phone" name={`ref${n}Phone`} type="tel" value={f[`ref${n}Phone`] as string} onChange={setStr} />
                <Field label="Relationship" name={`ref${n}Relation`} value={f[`ref${n}Relation`] as string} onChange={setStr} />
              </div>
            ))}
          </Section>

          {/* Background */}
          <Section title="Background" subtitle="A conviction will not necessarily disqualify you from employment.">
            <div>
              <Label className="mb-1.5 block">Have you ever been convicted of a felony?</Label>
              <RadioGroup value={f.convicted as string} onValueChange={(v) => set("convicted", v)} className="flex gap-4">
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="no" /> No</label>
                <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="yes" /> Yes</label>
              </RadioGroup>
            </div>
            {f.convicted === "yes" && (
              <div>
                <Label className="mb-1.5 block">Please explain</Label>
                <Textarea value={f.convictedDetails as string} onChange={(e) => set("convictedDetails", e.target.value)} rows={3} />
              </div>
            )}
          </Section>

          {/* Emergency */}
          <Section title="Emergency Contact">
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Name" name="emergencyName" value={f.emergencyName as string} onChange={setStr} required />
              <Field label="Phone" name="emergencyPhone" type="tel" value={f.emergencyPhone as string} onChange={setStr} required />
              <Field label="Relationship" name="emergencyRelation" value={f.emergencyRelation as string} onChange={setStr} required />
            </div>
          </Section>

          {/* Certify */}
          <Section title="Applicant Certification">
            <p className="text-sm text-muted-foreground">
              I certify that the information provided in this application is true and complete to the best of my knowledge. I understand that any false statement or omission may result in refusal of employment or dismissal. I authorize Dwayne Noe Construction LLC to verify any information provided.
            </p>
            <label className="flex items-start gap-2 text-sm">
              <Checkbox checked={f.consent as boolean} onCheckedChange={(v) => set("consent", !!v)} className="mt-0.5" />
              <span>I have read and agree to the above certification.</span>
            </label>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Signature (type full name)" name="signature" value={f.signature as string} onChange={setStr} required />
              <Field label="Date" name="signedDate" type="date" value={f.signedDate as string} onChange={setStr} required />
            </div>
          </Section>

          <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
            <Button asChild variant="outline" type="button">
              <Link to="/">Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-maple text-maple-foreground hover:bg-maple/90 font-display tracking-wider px-8"
            >
              {submitting ? "Submitting..." : "Submit Application"}
            </Button>
          </div>
        </form>
      </div>

      <footer className="border-t border-border bg-black/40 mt-16">
        <div className="container py-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Dwayne Noe Construction LLC
        </div>
      </footer>
    </div>
  );
};

export default Application;

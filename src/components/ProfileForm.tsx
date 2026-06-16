"use client";

import { useState, FormEvent } from "react";
import {
  StudentProfileSchema,
  type StudentProfile,
  type MatchResponse,
} from "@/lib/schemas";
import { FormSection, FullWidthField } from "./FormSection";
import { TagInput } from "./TagInput";
import { FieldError } from "./FieldError";
import { ResultsPanel } from "./ResultsPanel";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const US_STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"],
  ["DE", "Delaware"], ["DC", "D.C."], ["FL", "Florida"], ["GA", "Georgia"],
  ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"],
  ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"],
  ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"],
  ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"],
  ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"],
  ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"],
  ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"],
  ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
  ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"],
  ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
] as const;

const QUICK_ADD_ACTIVITIES = [
  "National Honor Society",
  "athletics:tennis",
  "athletics:basketball",
  "athletics:soccer",
  "debate",
  "volunteering",
  "student government",
  "robotics",
  "band",
  "theater",
  "stem club",
  "environmental club",
  "community service",
  "eagle scout",
  "4-h",
];

const QUICK_ADD_MAJORS = [
  "Computer Science",
  "Nursing",
  "Business",
  "Engineering",
  "Education",
  "Biology",
  "Psychology",
  "Communications",
  "Political Science",
  "Art & Design",
  "Pre-Med",
  "Social Work",
];

// ---------------------------------------------------------------------------
// Form state shape (all strings for controlled inputs)
// ---------------------------------------------------------------------------

interface FormState {
  gradeLevel: string;
  gradYear: string;
  homeState: string;
  citizenship: string;
  gpa: string;
  gpaScale: string;
  sat: string;
  act: string;
  psat: string;
  intendedMajors: string[];
  householdIncomeBand: string;
  dependentStatus: string;
  householdSize: string;
  activities: string[];
  firstGenCollegeStudent: boolean;
  genderIdentity: string;
  ethnicityTags: string[];
  militaryAffiliation: string;
}

const INITIAL_STATE: FormState = {
  gradeLevel: "",
  gradYear: "",
  homeState: "",
  citizenship: "",
  gpa: "",
  gpaScale: "4.0",
  sat: "",
  act: "",
  psat: "",
  intendedMajors: [],
  householdIncomeBand: "",
  dependentStatus: "",
  householdSize: "",
  activities: [],
  firstGenCollegeStudent: false,
  genderIdentity: "",
  ethnicityTags: [],
  militaryAffiliation: "",
};

// ---------------------------------------------------------------------------
// Field label styling helpers
// ---------------------------------------------------------------------------

function Label({
  htmlFor,
  children,
  optional,
}: {
  htmlFor: string;
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium text-gray-700 mb-1"
    >
      {children}
      {optional && (
        <span className="ml-1 text-xs font-normal text-gray-400">
          (optional)
        </span>
      )}
    </label>
  );
}

function inputCls(hasError: boolean) {
  return [
    "block w-full rounded-md border px-3 py-2 text-sm text-gray-900 bg-white shadow-sm transition-colors",
    "placeholder:text-gray-400",
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
      : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
  ].join(" ");
}

function selectCls(hasError: boolean) {
  return [
    "block w-full rounded-md border px-3 py-2 text-sm text-gray-900 bg-white shadow-sm transition-colors",
    hasError
      ? "border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-500"
      : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500",
  ].join(" ");
}

// ---------------------------------------------------------------------------
// Helper: coerce form state → StudentProfile shape for Zod
// ---------------------------------------------------------------------------

function buildProfile(s: FormState): unknown {
  const testScores: Record<string, number> = {};
  if (s.sat) testScores.sat = parseInt(s.sat, 10);
  if (s.act) testScores.act = parseInt(s.act, 10);
  if (s.psat) testScores.psat = parseFloat(s.psat);

  const demographics: Record<string, unknown> = {};
  if (s.firstGenCollegeStudent) demographics.firstGenCollegeStudent = true;
  if (s.genderIdentity.trim()) demographics.genderIdentity = s.genderIdentity.trim();
  if (s.ethnicityTags.length) demographics.ethnicityTags = s.ethnicityTags;
  if (s.militaryAffiliation) demographics.militaryAffiliation = s.militaryAffiliation;

  return {
    gradeLevel: s.gradeLevel || undefined,
    gradYear: s.gradYear ? parseInt(s.gradYear, 10) : undefined,
    homeState: s.homeState || undefined,
    citizenship: s.citizenship || undefined,
    gpa: s.gpa !== "" ? parseFloat(s.gpa) : undefined,
    gpaScale: s.gpaScale !== "" ? parseFloat(s.gpaScale) : 4.0,
    testScores,
    intendedMajors: s.intendedMajors,
    householdIncomeBand: s.householdIncomeBand || undefined,
    dependentStatus: s.dependentStatus || undefined,
    householdSize:
      s.householdSize !== "" ? parseInt(s.householdSize, 10) : undefined,
    activities: s.activities,
    demographics: Object.keys(demographics).length > 0 ? demographics : undefined,
  };
}

// ---------------------------------------------------------------------------
// Extract field-level errors from Zod issues
// ---------------------------------------------------------------------------

type ZodIssue = { path: (string | number)[]; message: string };

function getFieldError(issues: ZodIssue[], ...path: string[]): string | undefined {
  const key = path.join(".");
  const issue = issues.find((i) => i.path.join(".") === key);
  return issue?.message;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProfileForm() {
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [fieldErrors, setFieldErrors] = useState<ZodIssue[]>([]);
  const [apiState, setApiState] = useState<
    | { status: "idle" }
    | { status: "loading" }
    | { status: "success"; data: MatchResponse }
    | { status: "error"; message: string }
  >({ status: "idle" });

  const set = (key: keyof FormState) => (value: FormState[typeof key]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setStr = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      set(key)(e.target.value as FormState[typeof key]);

  const err = (...path: string[]) => getFieldError(fieldErrors, ...path);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFieldErrors([]);

    const raw = buildProfile(form);
    const parsed = StudentProfileSchema.safeParse(raw);

    if (!parsed.success) {
      setFieldErrors(parsed.error.issues as ZodIssue[]);
      // Scroll to first error
      const firstErrorEl = document.querySelector("[aria-invalid='true']");
      firstErrorEl?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const profile: StudentProfile = parsed.data;

    setApiState({ status: "loading" });

    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          (body as { error?: string }).error ??
          `Server error (${res.status}). Please try again.`;
        setApiState({ status: "error", message: msg });
        return;
      }

      const data = (await res.json()) as MatchResponse;
      setApiState({ status: "success", data });

      // Scroll to results
      setTimeout(() => {
        document
          .getElementById("results-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch {
      setApiState({
        status: "error",
        message: "Network error — please check your connection and try again.",
      });
    }
  };

  const isLoading = apiState.status === "loading";

  return (
    <div className="space-y-10">
      <form
        onSubmit={handleSubmit}
        noValidate
        aria-label="Student profile form"
        className="space-y-6"
      >
        {/* ── Academic Background ── */}
        <FormSection
          title="Academic Background"
          description="Basic academic information used to match scholarship criteria."
        >
          {/* Grade Level */}
          <div>
            <Label htmlFor="gradeLevel">Current Grade Level</Label>
            <select
              id="gradeLevel"
              value={form.gradeLevel}
              onChange={setStr("gradeLevel")}
              className={selectCls(!!err("gradeLevel"))}
              aria-invalid={!!err("gradeLevel")}
              aria-describedby={err("gradeLevel") ? "gradeLevel-error" : undefined}
            >
              <option value="">Select grade level…</option>
              <option value="sophomore">Sophomore (10th)</option>
              <option value="junior">Junior (11th)</option>
              <option value="senior">Senior (12th)</option>
            </select>
            <FieldError id="gradeLevel-error" message={err("gradeLevel")} />
          </div>

          {/* Grad Year */}
          <div>
            <Label htmlFor="gradYear">Expected Graduation Year</Label>
            <input
              id="gradYear"
              type="number"
              min={2024}
              max={2040}
              placeholder="e.g. 2026"
              value={form.gradYear}
              onChange={setStr("gradYear")}
              className={inputCls(!!err("gradYear"))}
              aria-invalid={!!err("gradYear")}
              aria-describedby={err("gradYear") ? "gradYear-error" : undefined}
            />
            <FieldError id="gradYear-error" message={err("gradYear")} />
          </div>

          {/* GPA */}
          <div>
            <Label htmlFor="gpa">Unweighted GPA</Label>
            <input
              id="gpa"
              type="number"
              min={0}
              max={4}
              step={0.01}
              placeholder="e.g. 3.75"
              value={form.gpa}
              onChange={setStr("gpa")}
              className={inputCls(!!err("gpa"))}
              aria-invalid={!!err("gpa")}
              aria-describedby={err("gpa") ? "gpa-error" : undefined}
            />
            <FieldError id="gpa-error" message={err("gpa")} />
          </div>

          {/* GPA Scale */}
          <div>
            <Label htmlFor="gpaScale">GPA Scale</Label>
            <select
              id="gpaScale"
              value={form.gpaScale}
              onChange={setStr("gpaScale")}
              className={selectCls(!!err("gpaScale"))}
            >
              <option value="4.0">4.0 scale</option>
              <option value="5.0">5.0 (weighted)</option>
              <option value="100">100-point scale</option>
            </select>
            <FieldError id="gpaScale-error" message={err("gpaScale")} />
          </div>
        </FormSection>

        {/* ── Test Scores (all optional) ── */}
        <FormSection
          title="Test Scores"
          description="All optional — enter only what you have."
        >
          <div>
            <Label htmlFor="sat" optional>
              SAT Score
            </Label>
            <input
              id="sat"
              type="number"
              min={400}
              max={1600}
              step={10}
              placeholder="400 – 1600"
              value={form.sat}
              onChange={setStr("sat")}
              className={inputCls(!!err("testScores", "sat"))}
              aria-invalid={!!err("testScores", "sat")}
              aria-describedby={
                err("testScores", "sat") ? "sat-error" : undefined
              }
            />
            <FieldError id="sat-error" message={err("testScores", "sat")} />
          </div>

          <div>
            <Label htmlFor="act" optional>
              ACT Score
            </Label>
            <input
              id="act"
              type="number"
              min={1}
              max={36}
              placeholder="1 – 36"
              value={form.act}
              onChange={setStr("act")}
              className={inputCls(!!err("testScores", "act"))}
              aria-invalid={!!err("testScores", "act")}
              aria-describedby={
                err("testScores", "act") ? "act-error" : undefined
              }
            />
            <FieldError id="act-error" message={err("testScores", "act")} />
          </div>

          <div>
            <Label htmlFor="psat" optional>
              PSAT/NMSQT Score
            </Label>
            <input
              id="psat"
              type="number"
              min={320}
              max={1520}
              step={10}
              placeholder="320 – 1520"
              value={form.psat}
              onChange={setStr("psat")}
              className={inputCls(!!err("testScores", "psat"))}
            />
            <FieldError id="psat-error" message={err("testScores", "psat")} />
          </div>
        </FormSection>

        {/* ── Location & Citizenship ── */}
        <FormSection
          title="Location & Citizenship"
          description="Used to match state-specific and citizenship-based aid."
        >
          {/* Home State */}
          <div>
            <Label htmlFor="homeState">Home State</Label>
            <select
              id="homeState"
              value={form.homeState}
              onChange={setStr("homeState")}
              className={selectCls(!!err("homeState"))}
              aria-invalid={!!err("homeState")}
              aria-describedby={err("homeState") ? "homeState-error" : undefined}
            >
              <option value="">Select state…</option>
              {US_STATES.map(([abbr, name]) => (
                <option key={abbr} value={abbr}>
                  {name} ({abbr})
                </option>
              ))}
            </select>
            <FieldError id="homeState-error" message={err("homeState")} />
          </div>

          {/* Citizenship */}
          <div>
            <Label htmlFor="citizenship">Citizenship Status</Label>
            <select
              id="citizenship"
              value={form.citizenship}
              onChange={setStr("citizenship")}
              className={selectCls(!!err("citizenship"))}
              aria-invalid={!!err("citizenship")}
              aria-describedby={
                err("citizenship") ? "citizenship-error" : undefined
              }
            >
              <option value="">Select status…</option>
              <option value="us_citizen">U.S. Citizen</option>
              <option value="permanent_resident">Permanent Resident</option>
              <option value="daca">DACA</option>
              <option value="international">International Student</option>
              <option value="other">Other</option>
            </select>
            <FieldError id="citizenship-error" message={err("citizenship")} />
          </div>
        </FormSection>

        {/* ── Financial Information ── */}
        <FormSection
          title="Financial Information"
          description="Used to match need-based aid programs."
        >
          {/* Income Band */}
          <div>
            <Label htmlFor="householdIncomeBand">
              Household Income (Annual)
            </Label>
            <select
              id="householdIncomeBand"
              value={form.householdIncomeBand}
              onChange={setStr("householdIncomeBand")}
              className={selectCls(!!err("householdIncomeBand"))}
              aria-invalid={!!err("householdIncomeBand")}
              aria-describedby={
                err("householdIncomeBand")
                  ? "householdIncomeBand-error"
                  : undefined
              }
            >
              <option value="">Select income range…</option>
              <option value="0-30k">Under $30,000</option>
              <option value="30-48k">$30,000 – $48,000</option>
              <option value="48-75k">$48,000 – $75,000</option>
              <option value="75-110k">$75,000 – $110,000</option>
              <option value="110k+">Over $110,000</option>
            </select>
            <FieldError
              id="householdIncomeBand-error"
              message={err("householdIncomeBand")}
            />
          </div>

          {/* Dependent Status */}
          <div>
            <Label htmlFor="dependentStatus" optional>
              Dependent Status
            </Label>
            <select
              id="dependentStatus"
              value={form.dependentStatus}
              onChange={setStr("dependentStatus")}
              className={selectCls(false)}
            >
              <option value="">Not specified</option>
              <option value="dependent">Dependent (claimed on parent taxes)</option>
              <option value="independent">Independent</option>
            </select>
          </div>

          {/* Household Size */}
          <div>
            <Label htmlFor="householdSize" optional>
              Household Size
            </Label>
            <input
              id="householdSize"
              type="number"
              min={1}
              max={20}
              placeholder="Number of people"
              value={form.householdSize}
              onChange={setStr("householdSize")}
              className={inputCls(!!err("householdSize"))}
            />
            <FieldError
              id="householdSize-error"
              message={err("householdSize")}
            />
          </div>
        </FormSection>

        {/* ── Intended Majors ── */}
        <FormSection
          title="Intended Majors"
          description="Used to match major-specific scholarships."
        >
          <FullWidthField>
            <TagInput
              id="intendedMajors"
              label="Intended Majors"
              values={form.intendedMajors}
              onChange={set("intendedMajors") as (v: string[]) => void}
              placeholder="Type a major and press Enter…"
              quickAdd={QUICK_ADD_MAJORS}
              error={err("intendedMajors")}
            />
          </FullWidthField>
        </FormSection>

        {/* ── Activities & Achievements ── */}
        <FormSection
          title="Activities & Achievements"
          description="Clubs, sports, volunteer work, honors. Use the quick-add chips or type your own."
        >
          <FullWidthField>
            <TagInput
              id="activities"
              label="Activities"
              values={form.activities}
              onChange={set("activities") as (v: string[]) => void}
              placeholder="Type an activity and press Enter…"
              quickAdd={QUICK_ADD_ACTIVITIES}
              error={err("activities")}
            />
          </FullWidthField>
        </FormSection>

        {/* ── Optional Demographics ── */}
        <FormSection
          title="Additional Information"
          description="Optional. Helps match scholarships targeted to specific groups."
        >
          {/* First Gen */}
          <div className="sm:col-span-2 flex items-center gap-3">
            <input
              id="firstGenCollegeStudent"
              type="checkbox"
              checked={form.firstGenCollegeStudent}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  firstGenCollegeStudent: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor="firstGenCollegeStudent"
              className="text-sm text-gray-700"
            >
              I am a first-generation college student
            </label>
          </div>

          {/* Military Affiliation */}
          <div>
            <Label htmlFor="militaryAffiliation" optional>
              Military Affiliation
            </Label>
            <select
              id="militaryAffiliation"
              value={form.militaryAffiliation}
              onChange={setStr("militaryAffiliation")}
              className={selectCls(false)}
            >
              <option value="">None / Not applicable</option>
              <option value="none">None</option>
              <option value="active_duty">Active Duty Service Member</option>
              <option value="veteran">Veteran</option>
              <option value="dependent">Military Dependent</option>
            </select>
          </div>

          {/* Gender Identity */}
          <div>
            <Label htmlFor="genderIdentity" optional>
              Gender Identity
            </Label>
            <input
              id="genderIdentity"
              type="text"
              placeholder="e.g. Female, Non-binary…"
              value={form.genderIdentity}
              onChange={setStr("genderIdentity")}
              className={inputCls(false)}
            />
            <p className="mt-1 text-xs text-gray-400">
              Some scholarships target specific gender identities.
            </p>
          </div>

          {/* Ethnicity Tags */}
          <FullWidthField>
            <TagInput
              id="ethnicityTags"
              label="Racial / Ethnic Identity"
              values={form.ethnicityTags}
              onChange={set("ethnicityTags") as (v: string[]) => void}
              placeholder="e.g. Hispanic, Asian American…"
              quickAdd={[
                "Hispanic / Latino",
                "Black / African American",
                "Asian American",
                "Native American",
                "Pacific Islander",
                "White",
                "Multi-racial",
              ]}
            />
            <p className="mt-1 text-xs text-gray-400">
              Some scholarships are targeted to specific communities.
            </p>
          </FullWidthField>
        </FormSection>

        {/* Submit */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
          {fieldErrors.length > 0 && (
            <p
              className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex-1"
              role="alert"
            >
              Please fix the errors above before submitting.
            </p>
          )}
          {apiState.status === "error" && (
            <p
              className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex-1"
              role="alert"
            >
              {apiState.message}
            </p>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="ml-auto inline-flex items-center gap-2 px-8 py-3 rounded-lg bg-blue-700 text-white font-semibold text-sm hover:bg-blue-800 active:bg-blue-900 disabled:opacity-60 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 shadow-sm"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Finding matches…
              </>
            ) : (
              "Find Scholarships"
            )}
          </button>
        </div>
      </form>

      {/* Results */}
      {apiState.status === "success" && (
        <div id="results-section">
          <ResultsPanel
            results={apiState.data.results}
            generatedAt={apiState.data.meta.generatedAt}
          />
        </div>
      )}
    </div>
  );
}

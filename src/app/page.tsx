import { ProfileForm } from "@/components/ProfileForm";

export default function HomePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Hero */}
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
          Find Your Scholarships
        </h1>
        <p className="text-gray-500 text-lg max-w-2xl">
          Fill in your profile and we&apos;ll match you to scholarships and
          financial aid programs that fit your background, academics, and goals.
        </p>
      </div>

      {/* Form + Results */}
      <ProfileForm />
    </div>
  );
}

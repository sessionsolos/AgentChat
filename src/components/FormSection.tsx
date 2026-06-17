import { ReactNode } from "react";

interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function FormSection({ title, description, children }: FormSectionProps) {
  return (
    <fieldset className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <legend className="sr-only">{title}</legend>
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {description && (
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
      <div className="px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        {children}
      </div>
    </fieldset>
  );
}

export function FullWidthField({ children }: { children: ReactNode }) {
  return <div className="sm:col-span-2">{children}</div>;
}

import Image from "next/image";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/janiwheels-logo.png"
      alt="JaniWheels.com"
      width={1000}
      height={184}
      sizes="(min-width: 640px) 190px, 138px"
      priority
      className={`h-auto w-[138px] sm:w-[190px] ${className}`}
    />
  );
}

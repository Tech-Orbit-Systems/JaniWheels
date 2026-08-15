import Image from "next/image";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/janiwheels-logo.png"
      alt="JaniWheels.com"
      width={1000}
      height={184}
      priority
      className={`h-auto w-[138px] sm:w-[190px] ${className}`}
    />
  );
}

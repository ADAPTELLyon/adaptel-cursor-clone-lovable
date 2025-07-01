import Lottie from "lottie-react"
import successAnimation from "@/assets/lotties/AnimationSuccess.json"

export default function FullScreenLoader({
  message,
}: {
  message?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 space-y-4">
      <div className="w-32 h-32">
        <Lottie
          animationData={successAnimation}
          loop={false}
        />
      </div>
      {message && (
        <p className="text-gray-700 text-center font-semibold text-lg">
          {message}
        </p>
      )}
    </div>
  )
}

import { motion } from "framer-motion"

export default function FullScreenLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          className="w-12 h-12 border-4 border-gray-300 border-t-brand-red rounded-full animate-spin"
          initial={{ rotate: 0 }}
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        />
        {message && (
          <div className="text-gray-700 text-sm">{message}</div>
        )}
      </div>
    </div>
  )
}

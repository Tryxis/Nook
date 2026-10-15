import { useNavigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useGuestLogin } from '../api/hooks'
import { toast } from './ui'

export function GuestButton({ className = 'btn btn--ghost', label = 'Continue as guest' }: { className?: string; label?: string }) {
  const guest = useGuestLogin()
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className={className}
      disabled={guest.isPending}
      onClick={() =>
        guest.mutate(undefined, {
          onSuccess: () => navigate('/', { replace: true }),
          onError: (e) =>
            toast(
              e instanceof ApiError && e.status === 429
                ? 'Lots of guest visits from your network just now. Try again in a few minutes.'
                : (e as Error).message,
            ),
        })
      }
    >
      {guest.isPending ? 'Setting up a sample library…' : label}
    </button>
  )
}

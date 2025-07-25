import { startAuthorization } from "../actions";

export default async function LoginVercelPage() {
  return (
    <div className="bg-gray-100 h-screen flex items-center justify-center">
      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4 w-full max-w-sm">
        <h1 className="block text-gray-700 text-xl font-bold mb-6 text-center">
          Login via Vercel Marketplace
        </h1>
        <form method="POST" className="flex items-center justify-between gap-4">
          <button
            type="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            formAction={startAuthorization}
          >
            Login with explicit flow
          </button>
        </form>
      </div>
    </div>
  );
}

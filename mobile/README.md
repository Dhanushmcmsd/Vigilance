# Vigilance Mobile App

React Native (Expo SDK 51) app for field officers.

## Setup

```bash
cd mobile
npm install
cp .env.example .env
# Fill in your Supabase URL and anon key in .env
npx expo start
```

## Environment Variables

Create a `.env` file in the `mobile/` directory:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Project Structure

```
mobile/
├── app/
│   ├── _layout.tsx              # Root layout (AuthProvider + Stack navigator)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   └── login.tsx            # Login screen
│   └── (officer)/
│       ├── _layout.tsx          # AuthGuard wrapper
│       ├── index.tsx            # Branch type selection (CFC / Store)
│       ├── select-branch.tsx    # Branch list with search
│       ├── checklist.tsx        # Main checklist form
│       └── confirm.tsx          # Success + past submissions
├── components/
│   ├── AuthGuard.tsx            # Role-based route guard
│   ├── BranchCard.tsx           # Branch list item
│   ├── ChecklistItem.tsx        # Yes/No/N/A item with remark
│   ├── ProgressBar.tsx          # Animated progress bar
│   └── ToastMessage.tsx         # Slide-down toast notification
├── context/
│   └── AuthContext.tsx          # Auth state + Supabase session
├── lib/
│   ├── supabase.ts              # Supabase client with LargeSecureStore
│   └── storage.ts               # AsyncStorage helpers (drafts + offline queue)
├── app.json
├── babel.config.js
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## Features

- **Authentication**: Supabase Auth with secure token storage
- **Branch selection**: CFC and Store type selection with search
- **Checklist form**: 31 items across 7 sections with Yes/No/N/A responses
- **Offline support**: Draft saving and offline submission queue with auto-sync
- **Photo/file upload**: Camera and document picker with Supabase Storage
- **Progress tracking**: Animated progress bar showing completion
- **Toast notifications**: Slide-down animated toasts
- **Success screen**: Animated checkmark + compliance score + past submissions

## Supabase Storage

Create a bucket named `inspection-files` in your Supabase project:
1. Go to Storage → New Bucket
2. Name: `inspection-files`
3. Public: Yes (or configure RLS policies as needed)

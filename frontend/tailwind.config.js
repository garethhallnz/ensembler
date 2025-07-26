import flowbiteReact from "flowbite-react/plugin/tailwindcss";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "node_modules/flowbite-react/**/*.{js,jsx,ts,tsx}",
    ".flowbite-react/class-list.json"
  ],
  theme: {
    extend: {
      button: {
        color: {
          primary: 'bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-800',
          secondary: 'bg-gray-600 hover:bg-gray-700 text-white dark:bg-gray-700 dark:hover:bg-gray-800',
          success: 'bg-green-600 hover:bg-green-700 text-white dark:bg-green-700 dark:hover:bg-green-800',
          warning: 'bg-yellow-500 hover:bg-yellow-600 text-white dark:bg-yellow-600 dark:hover:bg-yellow-700',
          danger: 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800',
        },
      },
      card: {
        root: {
          base: 'flex rounded-lg border border-gray-200 bg-white shadow-md dark:border-gray-700 dark:bg-gray-800',
        },
      },
      modal: {
        root: {
          base: 'fixed top-0 right-0 left-0 z-50 h-modal h-screen overflow-y-auto overflow-x-hidden md:inset-0 md:h-full',
          show: {
            on: 'flex bg-gray-900 bg-opacity-50 dark:bg-opacity-80',
            off: 'hidden',
          },
        },
        content: {
          base: 'relative h-full w-full p-4 md:h-auto',
          inner: 'relative rounded-lg bg-white shadow dark:bg-gray-800 flex flex-col max-h-[90vh]',
        },
      },
      navbar: {
        root: {
          base: 'border-gray-200 bg-white px-2 py-2.5 dark:border-gray-700 dark:bg-gray-800 sm:px-4',
          rounded: {
            on: 'rounded',
            off: '',
          },
          bordered: {
            on: 'border',
            off: '',
          },
          inner: {
            base: 'mx-auto flex flex-wrap items-center justify-between',
            fluid: {
              on: '',
              off: 'container',
            },
          },
        },
      },
      sidebar: {
        root: {
          base: 'h-full',
          inner: 'h-full overflow-y-auto overflow-x-hidden rounded bg-white py-4 px-3 dark:bg-gray-800',
        },
        collapse: {
          button: 'group flex w-full items-center rounded-lg p-2 text-base font-normal text-gray-900 transition duration-75 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700',
          icon: {
            base: 'h-6 w-6 text-gray-500 transition duration-75 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-white',
            open: {
              off: '',
              on: 'text-gray-900',
            },
          },
          label: {
            base: 'ml-3 flex-1 whitespace-nowrap text-left',
            icon: 'h-6 w-6',
          },
        },
      },
      progress: {
        color: {
          dark: 'bg-gray-600 dark:bg-gray-300',
          blue: 'bg-blue-600',
          red: 'bg-red-600 dark:bg-red-500',
          green: 'bg-green-600 dark:bg-green-500',
          yellow: 'bg-yellow-400',
          indigo: 'bg-indigo-600 dark:bg-indigo-500',
          purple: 'bg-purple-600 dark:bg-purple-500',
          cyan: 'bg-cyan-600',
          gray: 'bg-gray-500',
          lime: 'bg-lime-600',
          pink: 'bg-pink-500',
          teal: 'bg-teal-600',
        },
      },
      badge: {
        root: {
          color: {
            info: 'bg-blue-100 text-blue-800 dark:bg-blue-200 dark:text-blue-800 group-hover:bg-blue-200 dark:group-hover:bg-blue-300',
            success: 'bg-green-100 text-green-800 dark:bg-green-200 dark:text-green-900 group-hover:bg-green-200 dark:group-hover:bg-green-300',
            warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-200 dark:text-yellow-900 group-hover:bg-yellow-200 dark:group-hover:bg-yellow-300',
            danger: 'bg-red-100 text-red-800 dark:bg-red-200 dark:text-red-900 group-hover:bg-red-200 dark:group-hover:bg-red-300',
          },
        },
      },
    },
  },
  plugins: [flowbiteReact],
};
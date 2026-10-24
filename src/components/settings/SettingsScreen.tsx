"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { CircleAlert, Download, Image as ImageIcon, Languages, Moon, RotateCcw, Smartphone, Sun, Volume2, Waves, WifiOff } from "lucide-react";
import type { Locale } from "@/types/car";
import { isStorageAvailable } from "@/lib/storage/local-storage";
import type { Theme } from "@/lib/settings";
import { statisticsStore, updateSettings, useHydrated, useSettings } from "@/hooks/use-persistent";
import { isIos, useInstallPrompt } from "@/hooks/use-install-prompt";
import { useCatalogue } from "@/hooks/use-catalogue";
import { useI18n } from "@/hooks/use-i18n";

const LANGUAGE_NAMES: Record<Locale, string> = { fr: "Français", en: "English" };

export function SettingsScreen() {
  const { t, number } = useI18n();
  const settings = useSettings();
  const catalogue = useCatalogue();
  const carCount = catalogue.status === "ready" ? number(catalogue.catalogue.cars.length) : "…";
  const hydrated = useHydrated();
  const { state: installState, install } = useInstallPrompt();
  const resetDialog = useRef<HTMLDialogElement>(null);
  const [resetDone, setResetDone] = useState(false);

  const themeOptions: { value: Theme; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: t.settings.light, Icon: Sun },
    { value: "dark", label: t.settings.dark, Icon: Moon },
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pt-6 sm:pt-10">
      <h1 className="font-display text-3xl sm:text-4xl">{t.settings.title}</h1>

      {hydrated && !isStorageAvailable() && (
        <p role="alert" className="alert alert-warning">
          <CircleAlert className="size-5" aria-hidden="true" />
          {t.settings.storageUnavailable}
        </p>
      )}

      <Section title={t.settings.appearance}>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 flex items-center gap-2 font-medium">
            <Languages className="size-5" aria-hidden="true" />
            {t.settings.language}
          </legend>
          <div className="join w-full">
            {(Object.keys(LANGUAGE_NAMES) as Locale[]).map((locale) => (
              <label
                key={locale}
                lang={locale}
                className="join-item btn min-h-11 flex-1 has-[:checked]:btn-neutral has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
              >
                <input
                  type="radio"
                  name="locale"
                  className="sr-only"
                  checked={settings.locale === locale}
                  onChange={() => updateSettings({ locale })}
                />
                {LANGUAGE_NAMES[locale]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 flex items-center gap-2 font-medium">
            <Sun className="size-5" aria-hidden="true" />
            {t.settings.theme}
          </legend>
          <div className="join w-full">
            {themeOptions.map(({ value, label, Icon }) => (
              <label
                key={value}
                className="join-item btn min-h-11 flex-1 has-[:checked]:btn-neutral has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
              >
                <input
                  type="radio"
                  name="theme"
                  className="sr-only"
                  checked={settings.theme === value}
                  onChange={() => updateSettings({ theme: value })}
                />
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <Toggle
          Icon={Volume2}
          label={t.settings.sound}
          help={t.settings.soundHelp}
          checked={settings.sound}
          onChange={(sound) => updateSettings({ sound })}
        />
        <Toggle
          Icon={Waves}
          label={t.settings.reducedMotion}
          help={t.settings.reducedMotionHelp}
          checked={settings.reducedMotion}
          onChange={(reducedMotion) => updateSettings({ reducedMotion })}
        />
      </Section>

      <Section title={t.settings.app}>
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 font-medium">
            <Smartphone className="size-5" aria-hidden="true" />
            {t.settings.install}
          </p>
          <p className="text-sm text-base-content/70">{t.settings.installHelp}</p>
          {installState === "installed" ? (
            <p className="text-sm text-success">{t.settings.installed}</p>
          ) : installState === "available" ? (
            <button type="button" className="btn btn-primary w-fit" onClick={install}>
              <Download className="size-4" aria-hidden="true" />
              {t.settings.install}
            </button>
          ) : (
            hydrated && <p className="text-sm">{isIos() ? t.settings.iosInstall : t.settings.installUnavailable}</p>
          )}
        </div>
      </Section>

      <Section title={t.settings.data}>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-base-content/70">{t.settings.resetHelp}</p>
          <button type="button" className="btn btn-outline btn-error w-fit" onClick={() => resetDialog.current?.showModal()}>
            <RotateCcw className="size-4" aria-hidden="true" />
            {t.settings.reset}
          </button>
          <p role="status" className="min-h-5 text-sm text-success">
            {resetDone ? t.settings.resetDone : ""}
          </p>
        </div>
      </Section>

      <Section title={t.settings.photos}>
        <p className="flex gap-2 text-sm">
          <ImageIcon className="size-5 shrink-0" aria-hidden="true" />
          {t.settings.photosText(carCount)}
        </p>
        <p className="flex gap-2 text-sm text-base-content/75">
          <WifiOff className="size-5 shrink-0" aria-hidden="true" />
          {t.settings.photosOffline}
        </p>
        <Link href="/credits" className="link link-primary w-fit text-sm font-medium">
          {t.settings.creditsLink}
        </Link>
      </Section>

      <dialog ref={resetDialog} className="modal modal-bottom sm:modal-middle" aria-labelledby="reset-title">
        <div className="modal-box">
          <h2 id="reset-title" className="text-lg font-semibold">
            {t.settings.resetConfirmTitle}
          </h2>
          <p className="py-3 text-base-content/80">{t.settings.resetConfirmText}</p>
          <form method="dialog" className="modal-action">
            <button className="btn" autoFocus>
              {t.settings.cancel}
            </button>
            <button
              className="btn btn-error"
              onClick={() => {
                statisticsStore.reset();
                setResetDone(true);
              }}
            >
              {t.settings.confirmReset}
            </button>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button tabIndex={-1}>{t.common.close}</button>
        </form>
      </dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-box border border-base-content/10 bg-base-100 p-5 shadow-sm">
      <h2 className="eyebrow">{title}</h2>
      {children}
    </section>
  );
}

function Toggle({
  Icon,
  label,
  help,
  checked,
  onChange,
}: {
  Icon: typeof Sun;
  label: string;
  help: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4">
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 font-medium">
          <Icon className="size-5" aria-hidden="true" />
          {label}
        </span>
        <span className="text-sm text-base-content/70">{help}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="toggle toggle-primary mt-1 shrink-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

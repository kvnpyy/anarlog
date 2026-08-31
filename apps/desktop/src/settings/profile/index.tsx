import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { CircleNotch } from "@phosphor-icons/react";
import { useForm } from "@tanstack/react-form";
import type { ReactNode } from "react";

import { Input } from "@anlg/ui/components/ui/input";
import { Textarea } from "@anlg/ui/components/ui/textarea";

import { SettingsPageTitle } from "~/settings/page-title";
import {
  type StoredSettingValues,
  useSetSettingValues,
  useStoredSettingValuesQuery,
} from "~/settings/queries";
import { SETTING_CONTROL_CLASS } from "~/settings/setting-row";
import { resolveConfigValues } from "~/shared/config";

const PROFILE_FORM_KEYS = [
  "user_profile_name",
  "user_profile_role",
  "user_profile_department",
  "user_profile_context",
] as const;

export function SettingsProfile() {
  const { data, isLoading, error } = useStoredSettingValuesQuery();

  if (error) {
    throw error;
  }
  if (isLoading || !data) {
    return (
      <div className="flex min-h-48 items-center justify-center">
        <CircleNotch
          aria-label={t`Loading settings`}
          className="text-muted-foreground size-5 animate-spin"
        />
      </div>
    );
  }

  return <ProfileSettingsForm storedSettings={data} />;
}

function ProfileSettingsForm({
  storedSettings,
}: {
  storedSettings: StoredSettingValues;
}) {
  const values = resolveConfigValues(PROFILE_FORM_KEYS, storedSettings);
  const setSettingValues = useSetSettingValues();
  const form = useForm({
    defaultValues: {
      name: values.user_profile_name,
      role: values.user_profile_role,
      department: values.user_profile_department,
      context: values.user_profile_context,
    },
    listeners: {
      onChange: ({ formApi }) => {
        void formApi.handleSubmit();
      },
    },
    onSubmit: ({ value }) => {
      setSettingValues({
        user_profile_name: value.name,
        user_profile_role: value.role,
        user_profile_department: value.department,
        user_profile_context: value.context,
      });
    },
  });

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <SettingsPageTitle title={<Trans>Profile</Trans>} />
        <p className="text-muted-foreground max-w-xl text-sm leading-6">
          <Trans>
            Tell Acorn who you are so Ask, recaps, and drafts can match your
            role and the work you care about.
          </Trans>
        </p>
      </div>

      <div className="flex max-w-xl flex-col gap-5">
        <form.Field name="name">
          {(field) => (
            <ProfileField id="user-profile-name" label={<Trans>Name</Trans>}>
              <Input
                id="user-profile-name"
                className={SETTING_CONTROL_CLASS}
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                placeholder={t`Your name`}
              />
            </ProfileField>
          )}
        </form.Field>
        <form.Field name="role">
          {(field) => (
            <ProfileField id="user-profile-role" label={<Trans>Role</Trans>}>
              <Input
                id="user-profile-role"
                className={SETTING_CONTROL_CLASS}
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                placeholder={t`Product manager, engineer, designer…`}
              />
            </ProfileField>
          )}
        </form.Field>
        <form.Field name="department">
          {(field) => (
            <ProfileField
              id="user-profile-department"
              label={<Trans>Department</Trans>}
            >
              <Input
                id="user-profile-department"
                className={SETTING_CONTROL_CLASS}
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                placeholder={t`Engineering, sales, operations…`}
              />
            </ProfileField>
          )}
        </form.Field>
        <form.Field name="context">
          {(field) => (
            <ProfileField
              id="user-profile-context"
              label={<Trans>What should Acorn know?</Trans>}
              description={
                <Trans>
                  Teams you work with, products you own, or how you like notes
                  written.
                </Trans>
              }
            >
              <Textarea
                id="user-profile-context"
                className="min-h-24"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                placeholder={t`I lead the notepad team and care most about follow-ups.`}
              />
            </ProfileField>
          )}
        </form.Field>
      </div>
    </div>
  );
}

function ProfileField({
  id,
  label,
  description,
  children,
}: {
  id: string;
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {description ? (
        <p className="text-muted-foreground text-xs">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

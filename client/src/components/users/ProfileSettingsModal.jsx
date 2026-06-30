import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import Avatar from "../ui/Avatar";
import Spinner from "../ui/Spinner";

const getErrorMessage = (err) =>
  err?.response?.data?.message || err?.message || "Failed to update profile.";

export default function ProfileSettingsModal({ onClose }) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [avatar, setAvatar] = useState(user?.avatar || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setName(user?.name || "");
    setAvatar(user?.avatar || "");
  }, [user?.name, user?.avatar]);

  const cleanName = name.trim();
  const cleanAvatar = avatar.trim();
  const hasChanges = useMemo(
    () =>
      cleanName !== (user?.name || "") ||
      cleanAvatar !== (user?.avatar || ""),
    [cleanAvatar, cleanName, user?.avatar, user?.name],
  );

  const canSave = cleanName.length >= 2 && cleanName.length <= 80 && hasChanges;

  const handleSave = async (event) => {
    event.preventDefault();

    if (!canSave || saving) return;

    setSaving(true);
    setError("");

    try {
      await updateProfile({
        name: cleanName,
        avatar: cleanAvatar,
      });
      onClose?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!saving) onClose?.();
  };

  return (
    <div
      className="aurora-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-settings-title"
    >
      <form className="aurora-dialog-card aurora-profile-dialog" onSubmit={handleSave}>
        <div className="aurora-dialog-content">
          <button
            type="button"
            className="aurora-dialog-close"
            onClick={handleCancel}
            disabled={saving}
            aria-label="Close profile settings"
          >
            x
          </button>

          <div className="aurora-profile-dialog__head">
            <Avatar name={name || "User"} src={cleanAvatar} size="xl" />

            <div>
              <h2 id="profile-settings-title" className="aurora-dialog-title">
                Profile settings
              </h2>
              <p className="aurora-dialog-desc">
                Update your display name and avatar URL.
              </p>
            </div>
          </div>

          <div className="aurora-profile-dialog__fields">
            <label className="aurora-profile-dialog__label">
              Name
              <input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
                minLength={2}
                maxLength={80}
                required
                disabled={saving}
                className="aurora-profile-dialog__input"
                autoFocus
              />
            </label>

            <label className="aurora-profile-dialog__label">
              Email
              <input
                value={user?.email || ""}
                readOnly
                disabled
                className="aurora-profile-dialog__input"
              />
            </label>

            <label className="aurora-profile-dialog__label">
              Avatar URL
              <input
                value={avatar}
                onChange={(event) => {
                  setAvatar(event.target.value);
                  setError("");
                }}
                placeholder="https://example.com/avatar.png"
                maxLength={500}
                disabled={saving}
                className="aurora-profile-dialog__input"
              />
            </label>
          </div>

          {error && (
            <p className="aurora-profile-dialog__error" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="aurora-dialog-actions">
          <button
            type="button"
            className="aurora-dialog-btn"
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="aurora-dialog-btn aurora-dialog-btn-primary"
            disabled={!canSave || saving}
          >
            {saving ? <Spinner size={14} /> : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

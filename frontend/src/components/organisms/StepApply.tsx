import { useTranslation } from 'react-i18next';
import { HiCheckCircle, HiXCircle, HiExclamationCircle } from 'react-icons/hi';
import Card from '../atoms/Card';
import Button from '../atoms/Button';
import { apiMessage } from '../../utils/apiMessage';

type PhaseStatus = 'pending' | 'active' | 'done' | 'error';

export interface ApplyPhase {
  key: string;
  label: string;
  detail?: string;
  status: PhaseStatus;
}

export interface ConnectResult {
  service: string;
  step: string;
  success: boolean;
  message: string;
  code?: string;
  params?: Record<string, unknown>;
}

interface StepApplyProps {
  applyPhases: ApplyPhase[];
  applyError: string | null;
  applyDone: boolean;
  connectResults: ConnectResult[];
  onComplete: () => void;
  onBackToConfig: () => void;
}

export default function StepApply({
  applyPhases, applyError, applyDone, connectResults, onComplete, onBackToConfig,
}: StepApplyProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2 text-left">
          {applyDone ? t('setup.apply.titleDone') : applyError ? t('setup.apply.titleError') : t('setup.apply.titleRunning')}
        </h2>
        <p className="text-gray-600 dark:text-gray-300 text-left">
          {applyDone
            ? t('setup.apply.subtitleDone')
            : applyError
              ? t('setup.apply.subtitleError')
              : t('setup.apply.subtitleRunning')}
        </p>
      </div>

      <Card>
        <Card.Body>
          <div className="space-y-4">
            {applyPhases.map((phase) => (
              <div key={phase.key} className="flex items-start gap-3 text-left">
                <div className="mt-0.5 shrink-0">
                  {phase.status === 'done' && <HiCheckCircle className="w-6 h-6 text-green-500" />}
                  {phase.status === 'error' && <HiXCircle className="w-6 h-6 text-red-500" />}
                  {phase.status === 'active' && (
                    <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-blue-500 dark:border-gray-600 dark:border-t-blue-400 animate-spin" />
                  )}
                  {phase.status === 'pending' && <div className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600" />}
                </div>
                <div className="flex-1">
                  <div className={`font-medium ${
                    phase.status === 'pending' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'
                  }`}>
                    {phase.label}
                  </div>
                  {phase.status === 'active' && phase.detail && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{phase.detail}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card.Body>
      </Card>

      {applyError && (
        <Card>
          <Card.Body>
            <div className="flex items-start gap-3 text-left">
              <HiExclamationCircle className="w-6 h-6 text-red-500 shrink-0" />
              <div className="flex-1">
                <p className="text-gray-900 dark:text-white font-medium">{applyError}</p>
                <Button color="gray" outline className="mt-3" onClick={onBackToConfig}>
                  {t('setup.apply.backToConfig')}
                </Button>
              </div>
            </div>
          </Card.Body>
        </Card>
      )}

      {applyDone && (
        <Card>
          <Card.Body>
            {connectResults.length > 0 && (
              <div className="space-y-1.5 mb-4">
                {connectResults.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm text-left">
                    {r.success
                      ? <HiCheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      : <HiExclamationCircle className="w-4 h-4 text-yellow-500 shrink-0" />}
                    <span className="text-gray-700 dark:text-gray-300">{apiMessage(t, r)}</span>
                  </div>
                ))}
              </div>
            )}
            <Button color="green" onClick={onComplete}>
              {t('setup.apply.goToDashboard')}
            </Button>
          </Card.Body>
        </Card>
      )}
    </div>
  );
}

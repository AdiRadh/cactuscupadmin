import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Loader2, Send, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import type { InvoiceCalculation, SendInvoicesRequest, SendInvoicesResponse } from '@/types';

interface SendInvoicesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEntryIds: string[];
  calculateInvoices: (entryIds: string[]) => Promise<InvoiceCalculation[]>;
  sendInvoices: (request: SendInvoicesRequest) => Promise<SendInvoicesResponse>;
  onSuccess: () => void;
}

export const SendInvoicesDialog: FC<SendInvoicesDialogProps> = ({
  open,
  onOpenChange,
  selectedEntryIds,
  calculateInvoices,
  sendInvoices,
  onSuccess,
}) => {
  const [calculations, setCalculations] = useState<InvoiceCalculation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SendInvoicesResponse | null>(null);

  // Calculate invoices when dialog opens
  useEffect(() => {
    if (open && selectedEntryIds.length > 0) {
      setIsLoading(true);
      setError(null);
      setResult(null);
      setCalculations([]);

      calculateInvoices(selectedEntryIds)
        .then((calcs) => {
          setCalculations(calcs);
        })
        .catch((err) => {
          console.error('Error calculating invoices:', err);
          setError(err instanceof Error ? err.message : 'Failed to calculate invoices');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [open, selectedEntryIds, calculateInvoices]);

  const handleSend = async () => {
    setIsSending(true);
    setError(null);

    try {
      const response = await sendInvoices({
        waitlistEntryIds: selectedEntryIds,
      });

      setResult(response);

      if (response.success) {
        // Close dialog and refresh after a short delay to show success
        setTimeout(() => {
          onOpenChange(false);
          onSuccess();
        }, 2000);
      }
    } catch (err) {
      console.error('Error sending invoices:', err);
      setError(err instanceof Error ? err.message : 'Failed to send invoices');
    } finally {
      setIsSending(false);
    }
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const totalAmount = calculations.reduce((sum, calc) => sum + calc.totalAmount, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-400" />
            Send Invoices
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              <span className="ml-3 text-white">Calculating invoice amounts...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
              <AlertCircle className="h-5 w-5 inline mr-2" />
              {error}
            </div>
          )}

          {/* Result State */}
          {result && (
            <div className="space-y-4">
              {result.success ? (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-green-400">
                  <CheckCircle className="h-5 w-5 inline mr-2" />
                  Successfully sent {result.totalSent} invoice{result.totalSent !== 1 ? 's' : ''}!
                </div>
              ) : (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-yellow-400">
                  <AlertCircle className="h-5 w-5 inline mr-2" />
                  Sent {result.totalSent} invoice{result.totalSent !== 1 ? 's' : ''}, {result.totalFailed} failed.
                </div>
              )}

              {/* Show individual results */}
              {result.results.length > 0 && (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {result.results.map((r) => {
                    const calc = calculations.find((c) => c.waitlistEntryId === r.waitlistEntryId);
                    return (
                      <div
                        key={r.waitlistEntryId}
                        className={`flex items-center justify-between p-2 rounded ${
                          r.success ? 'bg-green-500/5' : 'bg-red-500/5'
                        }`}
                      >
                        <span className="text-white">
                          {calc ? `${calc.firstName} ${calc.lastName}` : r.waitlistEntryId}
                        </span>
                        <span className={r.success ? 'text-green-400' : 'text-red-400'}>
                          {r.success ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <span className="flex items-center gap-1">
                              <XCircle className="h-4 w-4" />
                              <span className="text-sm">{r.error}</span>
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Invoice Preview */}
          {!isLoading && !error && !result && calculations.length > 0 && (
            <div className="space-y-4">
              <p className="text-slate-300">
                You are about to send invoices to {calculations.length} promoted waitlist member
                {calculations.length !== 1 ? 's' : ''}. Each invoice will be due in 7 days.
              </p>

              {/* Invoice Table */}
              <div className="bg-slate-900/50 rounded-lg border border-slate-700 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700 bg-slate-800">
                      <th className="text-left py-2 px-3 font-semibold text-white text-sm">Name</th>
                      <th className="text-left py-2 px-3 font-semibold text-white text-sm">Tournament</th>
                      <th className="text-right py-2 px-3 font-semibold text-white text-sm">Tournament Fee</th>
                      <th className="text-right py-2 px-3 font-semibold text-white text-sm">Event Reg</th>
                      <th className="text-right py-2 px-3 font-semibold text-white text-sm">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calculations.map((calc) => (
                      <tr
                        key={calc.waitlistEntryId}
                        className="border-b border-slate-700/50"
                      >
                        <td className="py-2 px-3 text-white text-sm">
                          {calc.firstName} {calc.lastName}
                        </td>
                        <td className="py-2 px-3 text-slate-300 text-sm">{calc.tournamentName}</td>
                        <td className="py-2 px-3 text-slate-300 text-sm text-right">
                          {formatCurrency(calc.tournamentFee)}
                        </td>
                        <td className="py-2 px-3 text-sm text-right">
                          {calc.needsEventRegistration ? (
                            <span className="text-orange-400">{formatCurrency(calc.eventRegistrationFee)}</span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-white text-sm text-right font-medium">
                          {formatCurrency(calc.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-800/50">
                      <td colSpan={4} className="py-2 px-3 text-white font-semibold text-right">
                        Grand Total:
                      </td>
                      <td className="py-2 px-3 text-white font-bold text-right">
                        {formatCurrency(totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Note about event registration */}
              {calculations.some((c) => c.needsEventRegistration) && (
                <p className="text-sm text-orange-400">
                  <AlertCircle className="h-4 w-4 inline mr-1" />
                  Some users don't have an event registration. Their invoice will include the Supporter Entry fee.
                </p>
              )}
            </div>
          )}

          {/* No calculations */}
          {!isLoading && !error && !result && calculations.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              No promoted entries found to invoice.
            </div>
          )}
        </div>

        <DialogFooter>
          {result ? (
            <Button
              onClick={() => {
                onOpenChange(false);
                if (result.totalSent > 0) {
                  onSuccess();
                }
              }}
              className="bg-slate-600 hover:bg-slate-500"
            >
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSending}
                className="border-slate-600 text-white hover:bg-slate-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={isLoading || isSending || calculations.length === 0}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send {calculations.length} Invoice{calculations.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

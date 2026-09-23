'use client';
import { useActionState } from 'react';

export function ActionForm({ 
  action, 
  children, 
  className,
  formRef
}: { 
    action: (formData: FormData) => Promise<unknown>, 
  children: React.ReactNode | ((props: { isPending: boolean }) => React.ReactNode),
  className?: string,
  formRef?: React.RefObject<HTMLFormElement | null>
}) {
      const [state, formAction, isPending] = useActionState(async (_prevState: unknown, formData: FormData) => {
       try {
           const result = await action(formData);
           if (result && typeof result === 'object' && 'error' in result && typeof (result as { error: unknown }).error === 'string') {
               return { error: (result as { error: string }).error };
           }
           return { success: true };
       } catch (err: unknown) {
           return { error: err instanceof Error ? err.message : "System error" };
       }
   }, null);

   return (
       <form action={formAction} className={className} ref={formRef}>
           <fieldset disabled={isPending} className="contents">
             {typeof children === 'function' ? children({ isPending }) : children}
           </fieldset>
           {state?.error && (
               <p className="text-destructive text-sm mt-2 font-medium" role="alert" aria-live="assertive">{state.error}</p>
           )}
       </form>
   );
}

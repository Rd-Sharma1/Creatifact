//Consider putting this one inside the modules/github/service.ts
//Chnage type of payload zod!!!

const pushEventService = async (payload: any) => {
    const { ref, repository, before, after, commits, compare } = payload;
};

export { pushEventService };
